'use server';

/**
 * Voucher PII consent Server Actions (post-cleanup-25 / cleanup-55).
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
 * R-NEW-6 — no silent fallback. On backend URL missing or audit failure
 * the action returns `{ ok: false, state: 'error-audit-failed', error: <code> }`
 * and delivery is BLOCKED. Synthetic audit IDs ('stub-audit-id') are
 * forbidden; STUB branch removed by cleanup-55 (TF-133).
 *
 * Auth: requests carry `Content-Type: application/json` only; the backend
 * endpoint is scoped to the store API key (OQ #2: publishable-api-key header
 * injection deferred — backend route verified to accept unauthenticated
 * store-scoped POST in v1.6.0 dev setup per STAGING-FREE / ADR-066).
 */

import { revalidatePath } from 'next/cache';

import {
  buildAuditPayload,
  type ConsentAuditAction
} from '@/lib/voucher-consent/buildAuditPayload';

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
  payload: ReturnType<typeof buildAuditPayload>
): Promise<ConsentActionResult> {
  const backendUrl = resolveBackendUrl();

  // AC2: backend URL missing → explicit error (NO STUB success path).
  if (!backendUrl) {
    return { ok: false, state: 'error-audit-failed', error: 'backend-url-missing' };
  }

  try {
    // AC1: verb→endpoint contract — all verbs route to the single consent endpoint.
    // The `action` field in `payload` ('grant' | 'withdraw' | 'pause') discriminates
    // the verb on the backend side. No verb-specific sub-paths exist (OQ #1 resolved).
    const response = await fetch(`${backendUrl}/store/voucher-pii-consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
    if (!response.ok) {
      // R-NEW-6: explicit error state, NIE silent fallback.
      return {
        ok: false,
        state: 'error-audit-failed',
        error: `backend returned ${response.status}`
      };
    }
    const json = (await response.json()) as { audit_id?: string; consent_audit_id?: string };
    // Support both `audit_id` (simple) and `consent_audit_id` (Story 2-2 full response).
    const auditId = json.audit_id ?? json.consent_audit_id;
    if (verb === 'grant') {
      return { ok: true, state: 'delivery-decision-recorded', auditId };
    }
    if (verb === 'withdraw') {
      return { ok: true, state: 'withdrawn', auditId };
    }
    return { ok: true, state: 'consent-pending', auditId };
  } catch (error) {
    return {
      ok: false,
      state: 'error-audit-failed',
      error: error instanceof Error ? error.message : 'unknown audit failure'
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

  const payload = buildAuditPayload({
    action: 'grant',
    token,
    locale,
    surface,
    occurredAt: Date.now()
  });
  const result = await postAuditAction('grant', payload);
  revalidatePath(`/[locale]/voucher-pii-consent/${token}`, 'page');
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

  const payload = buildAuditPayload({
    action: 'withdraw',
    token,
    locale,
    compensatesAuditId,
    surface,
    occurredAt: Date.now()
  });
  const result = await postAuditAction('withdraw', payload);
  revalidatePath(`/[locale]/voucher-pii-consent/${token}`, 'page');
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
  const pauseState =
    pauseStateRaw === 'paused' ||
    pauseStateRaw === 'timeout' ||
    pauseStateRaw === 'withdrawn'
      ? pauseStateRaw
      : 'considering';

  const payload = buildAuditPayload({
    action: 'pause',
    token,
    locale,
    pauseState,
    surface,
    occurredAt: Date.now()
  });
  const result = await postAuditAction('pause', payload);
  revalidatePath(`/[locale]/voucher-pii-consent/${token}`, 'page');
  return result;
}
