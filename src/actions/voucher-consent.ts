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
 * R-NEW-6 — no silent fallback. On audit failure the action returns
 * `{ ok: false, state: 'error-audit-failed', error: <code> }` and delivery
 * is BLOCKED. Synthetic audit IDs ('stub-audit-id') are forbidden; STUB branch
 * removed by cleanup-55 (TF-133). On 2xx without an audit id, the action also
 * fails closed (`error: 'missing-audit-id'`).
 *
 * Auth: sdk.client.fetch auto-injects `x-publishable-api-key` (TF-209 / Story 4.4),
 * satisfying marketGuardMiddleware on all /store/* routes.
 *
 * Schema: backend now accepts action-discriminated body (TF-208 / Story 4.4):
 *   grant   → { action, token, locale, surface, occurred_at, schema_version }
 *   withdraw → { action, token, locale, compensates_audit_id }
 *   pause   → { action, token, locale, pause_state }
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
import { sdk } from '@/lib/config';

// TF-209 (Story 4.4): migrated to sdk.client.fetch — publishable key auto-injected.

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
 * Posts a consent audit action to the backend via sdk.client.fetch (TF-209).
 *
 * AC1 verb→endpoint contract:
 *   All verbs → POST /store/voucher-pii-consent
 *   The `action` field in the audit payload body discriminates grant/withdraw/pause.
 *
 * sdk.client.fetch auto-injects x-publishable-api-key, satisfying marketGuardMiddleware
 * on all /store/* routes. Throws on non-2xx; catch block classifies status vs network.
 */
async function postAuditAction(
  verb: ConsentAuditAction,
  payload: ReturnType<typeof buildAuditPayload>,
  idempotencyKey: string
): Promise<ConsentActionResult> {
  try {
    const json = await sdk.client.fetch<{
      audit_id?: string;
      consent_audit_id?: string;
      withdrawal_audit_id?: string;
      pause_audit_id?: string;
    }>(
      '/store/voucher-pii-consent',
      {
        method: 'POST',
        headers: {
          // review M2: deterministic key for double-submit collapse.
          'Idempotency-Key': idempotencyKey,
        },
        body: payload,
        cache: 'no-store',
      }
    );

    // Support route-specific backend response ids plus the simple `audit_id`.
    const auditId =
      json.audit_id ??
      json.consent_audit_id ??
      json.withdrawal_audit_id ??
      json.pause_audit_id;
    // review M4: 2xx without audit id is failure (R-NEW-6 storefront-side symmetry).
    if (!auditId) {
      logger.warn('voucher_consent.attempt', {
        source: 'actions/voucher-consent',
        context: { verb, ok: false, error: 'missing-audit-id' },
      });
      return { ok: false, state: 'error-audit-failed', error: 'missing-audit-id' };
    }
    // Review F10: success-path telemetry stays out of warn/error tier so the
    // alerting baseline isn't polluted by happy-path POSTs. logger only exposes
    // warn/error in this module — fall back to warn-with-`ok:true` only if no
    // info channel exists; otherwise use info.
    const loggerWithInfo = logger as unknown as { info?: typeof logger.warn };
    const successSink = typeof loggerWithInfo.info === 'function' ? loggerWithInfo.info : logger.warn;
    successSink('voucher_consent.attempt', {
      source: 'actions/voucher-consent',
      context: { verb, ok: true },
    });
    if (verb === 'grant') return { ok: true, state: 'delivery-decision-recorded', auditId };
    if (verb === 'withdraw') return { ok: true, state: 'withdrawn', auditId };
    return { ok: true, state: 'consent-pending', auditId };
  } catch (error) {
    // sdk.client.fetch throws on non-2xx with {status} property; network failures throw Error.
    const statusCode = (error as { status?: number })?.status;
    if (statusCode) {
      // review M3: status code safe to return; no PII in error string.
      logger.warn('voucher_consent.attempt', {
        source: 'actions/voucher-consent',
        context: { verb, ok: false, status: statusCode },
      });
      // Review F14: return a stable error code (no free-form English) so the UI
      // can map to an i18n string. Generic `backend-error` bucket plus the
      // status code preserves diagnostic detail without UI-coupled wording.
      return {
        ok: false,
        state: 'error-audit-failed',
        error: `backend-error-${statusCode}`,
      };
    }
    const rawMessage = error instanceof Error ? error.message : 'unknown audit failure';
    logger.error('voucher_consent.attempt', {
      source: 'actions/voucher-consent',
      context: { verb, ok: false, error: 'network-error' },
      error_message: rawMessage,
    });
    return { ok: false, state: 'error-audit-failed', error: 'network-error' };
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
    // Review F13: fail fast on unknown pause_state instead of silently coercing
    // to 'considering'. AC2 requires schema-violation paths to return an error
    // code rather than a normalised payload.
    logger.warn('voucher_consent.invalid_pause_state', {
      source: 'actions/voucher-consent',
      context: { received: pauseStateRaw },
    });
    return {
      ok: false,
      state: 'error-audit-failed',
      error: 'invalid-pause-state',
    };
  }
  const pauseState: 'considering' | 'paused' | 'timeout' | 'withdrawn' = pauseStateRaw;

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
