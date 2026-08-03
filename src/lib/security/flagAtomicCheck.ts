/**
 * Story v160-5-9 (Atomic Flag Check Checkout) — pure helpers for FM-9
 * race-condition mitigation at the storefront layer.
 *
 * Komplementarny user-facing layer w stosunku do backend mor-policy
 * (READ COMMITTED + optimistic check + abort) per ADR-088-reassess
 * (specs/adr/2026-05-02-adr-088-reassess-atomic-flag-check.md). Backend
 * AD-88 path w `packages/api/src/lib/mor-policy/` pozostaje untouched —
 * storefront snapshot daje wcześniejsze, friendlier UX feedback przed
 * full network round-trip do `/store/carts/${id}/complete`.
 *
 * Phase A semantics (env-based snapshot):
 *  - Flag value resolved z `process.env.NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED`
 *    (matches Story 5.1 pattern; defaults to `false`).
 *  - Snapshot persistence delegated to caller (Option A: cart_metadata
 *    via `sdk.store.cart.update`; Option B: cookie fallback).
 *  - Drift detection = strict `===` comparison vs current env value.
 *  - On drift → throw `FlagDriftError` z full context (expectedFlag,
 *    currentFlag, snapshotTs).
 *
 * Phase B+ may upgrade `getCurrentFlagValue` do live admin-DB call
 * jeśli kiedyś zechcemy zerwać z env-based pattern.
 *
 * Module is pure — no side effects beyond throw — i SSR-safe (czyta tylko
 * `process.env`, dostępne na obu stronach Next.js boundary).
 */

/**
 * Phase A flag snapshot shape — captured at cart-start, persisted przez
 * caller (Option A cart_metadata lub Option B cookie). `ts` jest ISO-8601
 * timestamp dla observability (drift incident debug).
 */
export interface FlagSnapshot {
  flag: boolean;
  ts: string;
}

/**
 * Reads current `NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED` env value.
 *
 * Pattern matches Story 5.1 / 5.5 / 5.7 callsites — strict `=== 'true'`
 * comparison, defaults to `false` gdy env unset (production-safe). Reading
 * `process.env.*` z `NEXT_PUBLIC_` prefix is inlined at build-time przez
 * Next.js, więc bezpieczne dla SSR + client.
 *
 * Per ADR-074 (tri-state-flag-semantics): Phase A treats wszystkie wartości
 * inne niż `'true'` jako OFF (nie tri-state — to jest Phase B+ territory).
 */
export function getCurrentFlagValue(): boolean {
  return process.env.NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED === 'true';
}

/**
 * Captures current flag value + ISO timestamp jako snapshot dla cart-start
 * persistence. Pure function — caller decides where to persist (cart_metadata
 * vs cookie vs localStorage).
 *
 * Per AC2 idempotency requirement: caller MUSI sprawdzić existing snapshot
 * przed persistence — pierwszy zapis wygrywa (cart lifecycle = od first item
 * do completion lub cleanup).
 */
export function snapshotFlagAtCartStart(): FlagSnapshot {
  return {
    flag: getCurrentFlagValue(),
    ts: new Date().toISOString()
  };
}

/**
 * Verifies that captured snapshot still matches current env flag value.
 *
 * Throws `FlagDriftError` jeśli admin flipnął flagę mid-checkout (FM-9
 * window). Returns void on match (happy-path).
 *
 * Per AC3: caller (`placeOrder` w `src/lib/data/cart.ts`) wywołuje to PRZED
 * `fetchQuery('/store/carts/${id}/complete', ...)`; on `FlagDriftError`
 * propaguje out → checkout submit button catch path obsługuje modal display.
 *
 * Snapshot missing scenario (no snapshot persisted) jest handled przez
 * caller (fail-open Phase A — backend mor-policy retains FM-9 guarantee
 * per ADR-088-reassess).
 */
export function verifyFlagUnchanged(snapshot: FlagSnapshot): void {
  const currentFlag = getCurrentFlagValue();
  if (currentFlag !== snapshot.flag) {
    throw new FlagDriftError({
      expectedFlag: snapshot.flag,
      currentFlag,
      snapshotTs: snapshot.ts
    });
  }
}

/**
 * Typed error class dla FM-9 drift detection. Carries full context dla
 * observability + UX layer (modal może display ts dla user-friendly
 * "started X minutes ago" hint w future iteration).
 *
 * Per AC1: `name = 'FlagDriftError'` enables `instanceof` checks oraz
 * runtime `error.name === 'FlagDriftError'` discriminator (gdy modal
 * wire-up potrzebuje typeguard bez pełnego import).
 */
export class FlagDriftError extends Error {
  public readonly expectedFlag: boolean;
  public readonly currentFlag: boolean;
  public readonly snapshotTs: string;

  constructor(params: {
    expectedFlag: boolean;
    currentFlag: boolean;
    snapshotTs: string;
  }) {
    super(
      `Multi-vendor pricing flag drift detected: snapshot=${params.expectedFlag} (ts=${params.snapshotTs}) vs current=${params.currentFlag}`
    );
    this.name = 'FlagDriftError';
    this.expectedFlag = params.expectedFlag;
    this.currentFlag = params.currentFlag;
    this.snapshotTs = params.snapshotTs;

    // Preserve prototype chain dla instanceof checks (TS lib target ES5 quirk).
    Object.setPrototypeOf(this, FlagDriftError.prototype);
  }
}
