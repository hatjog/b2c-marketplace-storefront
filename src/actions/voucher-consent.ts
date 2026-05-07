'use server';

/**
 * Voucher PII consent Server Actions (post-cleanup-25 / cleanup-55, hardened
 * by cleanup-55 review).
 *
 * Three actions backing the consent moment UI:
 *   - grantConsent      — active opt-in path; chained Postgres tx (D-66)
 *   - withdrawConsent   — Art. 7(3) symmetric withdrawal
 *   - pauseRecipient    — SC-3 ambivalence pause (UX-DR5 5-state machine)
 *
 * Verb → endpoint table (AC1):
 *   grant     → POST /store/voucher-pii-consent   (body: action='grant')
 *   withdraw  → POST /store/voucher-pii-consent   (body: action='withdraw')
 *   pause     → POST /store/voucher-pii-consent   (body: action='pause')
 *
 * All three verbs route to the same backend endpoint
 * (`/store/voucher-pii-consent`), provisioned by cleanup-25 / Story 2-2.
 * The `action` field in the audit payload body discriminates the verb on
 * the backend. There are no verb-specific sub-paths — OQ #1 verified
 * against cleanup-25 routes file during dev pickup (2026-05-07).
 *
 * KNOWN CONTRACT DRIFT (cleanup-55 review H1 / H2):
 *   The backend route `GP/backend/src/api/store/voucher-pii-consent/route.ts`
 *   currently validates fields `market_id`, `order_id`, `entitlement_id`,
 *   `locale`, `is_gift`, while this Server Action POSTs the
 *   `buildAuditPayload(...)` shape (`action`, `token`, `locale`, `surface`,
 *   `occurred_at`, `schema_version`, optional `compensates_audit_id` /
 *   `pause_state`). Until the JSON-shape harmonisation lands (tracked as
 *   TF-NEW follow-up to cleanup-55), live POSTs return HTTP 400 and the
 *   Server Action surfaces `{ ok: false, state: 'error-audit-failed',
 *   error: 'backend returned 400' }` — explicitly NOT silent success per
 *   R-NEW-6. Withdraw / pause have no backend route at all today; they
 *   share the same code path so the same explicit-error semantics apply.
 *
 * R-NEW-6 — no silent fallback. On backend URL missing or audit failure
 * the action returns `{ ok: false, state: 'error-audit-failed', error: <code> }`
 * and delivery is BLOCKED. Synthetic audit IDs ('stub-audit-id') are
 * forbidden; STUB branch removed by cleanup-55 (TF-133). On 2xx without an
 * audit id, the action also fails closed (`error: 'missing-audit-id'`).
 *
 * Auth: requests carry `Content-Type: application/json` only; the backend
 * endpoint is scoped to the store API key (OQ #2: publishable-api-key header
 * injection deferred — backend route verified to accept unauthenticated
 * store-scoped POST in v1.6.0 dev setup per STAGING-FREE / ADR-066). Tracked
 * as TF-NEW (v1.7.0 auth header rollout) — see cleanup-55 review L1.
 *
 * Idempotency: each POST carries an `Idempotency-Key` header derived from
 * `action + token + minute-bucket(occurred_at)`, so an accidental
 * double-submit within the same minute will collapse to a single audit row
 * once the backend honours the header (cleanup-55 review M2).
 */

import { revalidatePath } from 'next/cache';

import {
  buildAuditPayload,
  type ConsentAuditAction
} from '@/lib/voucher-consent/buildAuditPayload';
import { logger } from '@/lib/logger';

export type ConsentActionState =
  | 'idle'
  | 'consent-pending'
  | 'audit-recording'
  | 'audit-confirmed'
  | 'delivery-decision-recorded'
  | 'error-audit-failed'
  | 'withdrawal-pending'
  | 'withdrawn';

export interface ConsentActionResult {
  ok: boolean;
  state: ConsentActionState;
  auditId?: string;
  error?: string;
}

function resolveBackendUrl(): string | null {
  return (
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    null
  );
}

/**
 * Deterministic Idempotency-Key for collapse-on-double-submit (review M2).
 * Bucket to the minute so retries within one minute reuse the same key.
 */
function buildIdempotencyKey(
  verb: ConsentAuditAction,
  token: string,
  occurredAt: number
): string {
  const minuteBucket = Math.floor(occurredAt / 60_000);
  return `${verb}:${token}:${minuteBucket}`;
}

/**
 * Posts a consent audit action to the backend.
 *
 * AC1 verb→endpoint contract:
 *   All verbs → POST ${backendUrl}/store/voucher-pii-consent
 *   The `action` field in the audit payload body discriminates grant/withdraw/pause.
 *
 * When backendUrl is unresolved, returns explicit error (not synthetic success)
 * per R-NEW-6 / TF-133 fix.
 */
async function postAuditAction(
  verb: ConsentAuditAction,
  payload: ReturnType<typeof buildAuditPayload>,
  idempotencyKey: string
): Promise<ConsentActionResult> {
  const backendUrl = resolveBackendUrl();

  // AC2: backend URL missing → explicit error (NO STUB success path).
  if (!backendUrl) {
    logger.warn('voucher_consent.attempt', {
      source: 'actions/voucher-consent',
      context: { verb, ok: false, error: 'backend-url-missing' },
    });
    return { ok: false, state: 'error-audit-failed', error: 'backend-url-missing' };
  }

  try {
    // AC1: verb→endpoint contract — all verbs route to the single consent endpoint.
    // The `action` field in `payload` ('grant' | 'withdraw' | 'pause') discriminates
    // the verb on the backend side. No verb-specific sub-paths exist (OQ #1 resolved).
    //
    // Note (review L2): we use raw `fetch` rather than `sdk.client.fetch` because
    // this is a Server Action (server-side) and the consent endpoint is store-scoped
    // without auth in v1.6.0 (per ADR-066 / OQ #2). Once auth header injection lands
    // (TF-NEW v1.7.0), this should migrate to `sdk.client.fetch`.
    const response = await fetch(`${backendUrl}/store/voucher-pii-consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // review M2: deterministic key for double-submit collapse (backend-honoured TBD).
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
    if (!response.ok) {
      // R-NEW-6: explicit error state, NIE silent fallback.
      logger.warn('voucher_consent.attempt', {
        source: 'actions/voucher-consent',
        context: { verb, ok: false, status: response.status },
      });
      return {
        ok: false,
        state: 'error-audit-failed',
        error: `backend returned ${response.status}`
      };
    }
    const json = (await response.json()) as { audit_id?: string; consent_audit_id?: string };
    // Support both `audit_id` (simple) and `consent_audit_id` (Story 2-2 full response).
    const auditId = json.audit_id ?? json.consent_audit_id;
    // review M4: 2xx without audit id is failure (R-NEW-6 storefront-side symmetry).
    if (!auditId) {
      logger.warn('voucher_consent.attempt', {
        source: 'actions/voucher-consent',
        context: { verb, ok: false, error: 'missing-audit-id' },
      });
      return { ok: false, state: 'error-audit-failed', error: 'missing-audit-id' };
    }
    logger.warn('voucher_consent.attempt', {
      source: 'actions/voucher-consent',
      context: { verb, ok: true },
    });
    if (verb === 'grant') {
      return { ok: true, state: 'delivery-decision-recorded', auditId };
    }
    if (verb === 'withdraw') {
      return { ok: true, state: 'withdrawn', auditId };
    }
    return { ok: true, state: 'consent-pending', auditId };
  } catch (error) {
    // review M3: classify network errors generically; raw message goes to logger
    // (which sanitizes URLs) but is NOT returned to caller verbatim.
    const rawMessage = error instanceof Error ? error.message : 'unknown audit failure';
    logger.error('voucher_consent.attempt', {
      source: 'actions/voucher-consent',
      context: { verb, ok: false, error: 'network-error' },
      error_message: rawMessage,
    });
    return {
      ok: false,
      state: 'error-audit-failed',
      error: 'network-error'
    };
  }
}

export async function grantConsent(formData: FormData): Promise<ConsentActionResult> {
  const token = String(formData.get('token') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'pl').trim();
  const consent = formData.get('consent');
  const surface: 'js' | 'no-js' =
    String(formData.get('surface') ?? 'no-js') === 'js' ? 'js' : 'no-js';

  if (!token) {
    return { ok: false, state: 'error-audit-failed', error: 'missing-token' };
  }
  // Active opt-in invariant — Art. 7 GDPR / CJEU Planet49 / ADR-068.
  if (consent !== 'on' && consent !== 'true') {
    return { ok: false, state: 'idle', error: 'consent-not-granted' };
  }

  const occurredAt = Date.now();
  let payload: ReturnType<typeof buildAuditPayload>;
  try {
    payload = buildAuditPayload({
      action: 'grant',
      token,
      locale,
      surface,
      occurredAt,
    });
  } catch {
    // review H3: never let buildAuditPayload throw escape the Server Action.
    return { ok: false, state: 'error-audit-failed', error: 'invalid-payload' };
  }
  const result = await postAuditAction(
    'grant',
    payload,
    buildIdempotencyKey('grant', token, occurredAt)
  );
  // review H4: parameterised path tag (no token literal in cache key).
  // review I2: only revalidate on success.
  if (result.ok) {
    revalidatePath('/[locale]/voucher-pii-consent/[token]', 'page');
  }
  return result;
}

export async function withdrawConsent(
  formData: FormData
): Promise<ConsentActionResult> {
  const token = String(formData.get('token') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'pl').trim();
  const compensatesAuditId = String(formData.get('compensates_audit_id') ?? '').trim();
  const surface: 'js' | 'no-js' =
    String(formData.get('surface') ?? 'no-js') === 'js' ? 'js' : 'no-js';

  if (!token) {
    return { ok: false, state: 'error-audit-failed', error: 'missing-token' };
  }
  if (!compensatesAuditId) {
    // Withdrawal needs the original grant audit row id for the chain link.
    return {
      ok: false,
      state: 'error-audit-failed',
      error: 'missing-compensates-audit-id'
    };
  }

  const occurredAt = Date.now();
  let payload: ReturnType<typeof buildAuditPayload>;
  try {
    payload = buildAuditPayload({
      action: 'withdraw',
      token,
      locale,
      compensatesAuditId,
      surface,
      occurredAt,
    });
  } catch {
    return { ok: false, state: 'error-audit-failed', error: 'invalid-payload' };
  }
  const result = await postAuditAction(
    'withdraw',
    payload,
    buildIdempotencyKey('withdraw', token, occurredAt)
  );
  if (result.ok) {
    revalidatePath('/[locale]/voucher-pii-consent/[token]', 'page');
  }
  return result;
}

export async function pauseRecipient(formData: FormData): Promise<ConsentActionResult> {
  const token = String(formData.get('token') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'pl').trim();
  const pauseStateRaw = String(formData.get('pause_state') ?? 'considering');
  const surface: 'js' | 'no-js' =
    String(formData.get('surface') ?? 'no-js') === 'js' ? 'js' : 'no-js';

  if (!token) {
    return { ok: false, state: 'error-audit-failed', error: 'missing-token' };
  }
  const isKnownPauseState =
    pauseStateRaw === 'paused' ||
    pauseStateRaw === 'timeout' ||
    pauseStateRaw === 'withdrawn' ||
    pauseStateRaw === 'considering';
  if (!isKnownPauseState) {
    // review L4: surface invalid input rather than silently coerce.
    logger.warn('voucher_consent.invalid_pause_state', {
      source: 'actions/voucher-consent',
      context: { coerced_to: 'considering' },
    });
  }
  const pauseState: 'considering' | 'paused' | 'timeout' | 'withdrawn' =
    pauseStateRaw === 'paused' ||
    pauseStateRaw === 'timeout' ||
    pauseStateRaw === 'withdrawn'
      ? pauseStateRaw
      : 'considering';

  const occurredAt = Date.now();
  let payload: ReturnType<typeof buildAuditPayload>;
  try {
    payload = buildAuditPayload({
      action: 'pause',
      token,
      locale,
      pauseState,
      surface,
      occurredAt,
    });
  } catch {
    // review H3: pauseState is always set above, but be defensive.
    return { ok: false, state: 'error-audit-failed', error: 'invalid-payload' };
  }
  const result = await postAuditAction(
    'pause',
    payload,
    buildIdempotencyKey('pause', token, occurredAt)
  );
  if (result.ok) {
    revalidatePath('/[locale]/voucher-pii-consent/[token]', 'page');
  }
  return result;
}
