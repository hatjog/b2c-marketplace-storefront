/**
 * Story v170-2-9: FR64 consumer-purchase withdrawal state helper.
 *
 * Provides a pure, data-shape-driven function that maps order/voucher data to
 * one of the five canonical FR64 withdrawal lifecycle states.
 *
 * IMPORTANT — lifecycle boundary:
 *   This module covers **consumer-purchase withdrawal** (Ustawa o prawach
 *   konsumenta, 14-day window before service execution).
 *   It is DISTINCT from recipient-PII consent (RODO Art. 7/17) which uses
 *   `VoucherStatus` ("idle" | "consent_pending" | "claimed" | "withdrawn")
 *   from `@/lib/data/voucher.ts`.
 *
 * Design decisions:
 *   - The function is intentionally pure and data-shape-driven: it accepts
 *     a typed `VoucherWithdrawalInput` rather than fetching data itself, so
 *     it can be tested without HTTP mocks.
 *   - When state CANNOT be derived deterministically (missing fields, stale
 *     data, wrong market, or unknown intermediate state), the function returns
 *     `"support-review"` and sets `action_blocked = true`. The UI must NEVER
 *     silently default to `"withdrawal-eligible-before-service-execution"` in
 *     this case — that would bypass Epic 7 gate enforcement.
 *   - `freshness` is a pass-through from the caller context; this helper does
 *     not implement freshness window logic (which is flow-specific) but does
 *     downgrade stale/missing freshness to `"support-review"`.
 *
 * Deferred backing-data work:
 *   The `VoucherWithdrawalInput` type has optional fields that are not yet
 *   present in the Mercur 2 voucher payload:
 *     - `consent_to_execute_captured`: not yet returned by backend; defaults
 *       to `false` (conservative). Epic 7 / Story 6.x must fill this field.
 *     - `service_executed_at`: not yet returned by backend; `undefined` is
 *       treated as "not executed". Epic 7 / Story 6.x must fill this field.
 *     - `refunded_at`: not yet returned by backend; `undefined` means no
 *       refund. Epic 7 / Story 6.x must fill this field.
 *   Until these fields are available, most real vouchers will resolve to
 *   `"withdrawal-eligible-before-service-execution"` (conservative safe state)
 *   or `"support-review"` (when market is unknown). This is intentional —
 *   the UI contract is established now; backing data follows.
 *
 * @module lib/helpers/withdrawal-state
 * @see FR64 (prd.md line 933); Story 2.9 Dev Notes
 */

import type { WithdrawalLifecycleState, WithdrawalStateResult, WithdrawalFreshness } from '@/types/voucher';
import { getMarketId } from '@/lib/helpers/market-filter';

/**
 * Input shape for withdrawal state derivation.
 *
 * All fields are optional to accommodate the current Mercur 2 payload gaps
 * (see module-level JSDoc for deferred backing-data work).
 */
export interface VoucherWithdrawalInput {
  /**
   * True if the customer explicitly consented to immediate service execution
   * before the 14-day withdrawal window, thereby waiving the right of withdrawal.
   * Deferred: not yet in Mercur 2 voucher payload — treat `undefined` as `false`.
   */
  consent_to_execute_captured?: boolean;

  /**
   * ISO 8601 timestamp of when the service was performed.
   * Deferred: not yet in Mercur 2 voucher payload — treat `undefined` as "not executed".
   */
  service_executed_at?: string | null;

  /**
   * ISO 8601 timestamp of when a refund was issued.
   * Deferred: not yet in Mercur 2 voucher payload — treat `undefined` as "not refunded".
   */
  refunded_at?: string | null;

  /**
   * Market id override. When omitted, `getMarketId()` is called.
   * Pass explicitly in tests to avoid env dependency.
   */
  market_id?: string;

  /**
   * Freshness classification provided by the calling flow context.
   * When `"stale"` or `"missing"`, the result is forced to `"support-review"`.
   */
  freshness?: WithdrawalFreshness;
}

/**
 * Derive the FR64 consumer-purchase withdrawal state from order/voucher data.
 *
 * State resolution priority (highest to lowest):
 *   1. Freshness guard — stale/missing → support-review (AC3: no silent fallback)
 *   2. Refunded — refunded_at present → refunded
 *   3. Executed — service_executed_at present → withdrawal-blocked-after-execution
 *   4. Consent captured — consent_to_execute_captured → consent-to-execute-captured
 *   5. Default eligible — none of the above → withdrawal-eligible-before-service-execution
 *
 * @param input - Voucher/order data fields relevant to FR64 state derivation.
 * @returns A `WithdrawalStateResult` containing the canonical state token,
 *          market_id, freshness and whether a release-critical CTA was blocked.
 */
export function getWithdrawalState(input: VoucherWithdrawalInput = {}): WithdrawalStateResult {
  const {
    consent_to_execute_captured = false,
    service_executed_at,
    refunded_at,
    market_id: inputMarketId,
    freshness = 'current',
  } = input;

  const market_id = inputMarketId ?? getMarketId();

  // Guard 1: stale or missing freshness → support-review, action blocked (AC3)
  if (freshness === 'stale' || freshness === 'missing') {
    return {
      state: 'support-review',
      market_id,
      freshness,
      action_blocked: true,
    };
  }

  // Guard 2: missing/empty market_id → "wrong-market for the active session"
  // per AC3 sub-bullet 1. Treated as a non-deterministic state — Epic 7 must
  // see `freshness: "missing"` and `state: "support-review"`. Review fix H2.
  if (!market_id) {
    return {
      state: 'support-review',
      market_id: '',
      freshness: 'missing',
      action_blocked: true,
    };
  }

  // Determine the canonical FR64 state
  let state: WithdrawalLifecycleState;

  if (refunded_at) {
    state = 'refunded';
  } else if (service_executed_at) {
    state = 'withdrawal-blocked-after-execution';
  } else if (consent_to_execute_captured) {
    state = 'consent-to-execute-captured';
  } else {
    state = 'withdrawal-eligible-before-service-execution';
  }

  return {
    state,
    market_id,
    freshness: 'current',
    action_blocked: false,
  };
}

/**
 * Returns true when the given FR64 state should block a release-critical CTA.
 *
 * Release-critical CTAs (place order at checkout, confirm voucher delivery,
 * request voucher recovery, mark service-executed) must be disabled when state
 * cannot be determined deterministically.
 */
export function isWithdrawalCriticalActionBlocked(result: WithdrawalStateResult): boolean {
  return result.action_blocked || result.state === 'support-review';
}
