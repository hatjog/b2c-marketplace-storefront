'use server';

/**
 * Voucher PII consent Server Actions (STORY-2-1).
 *
 * Three actions backing the consent moment UI:
 *   - grantConsent      — active opt-in path; chained Postgres tx (STUB)
 *   - withdrawConsent   — Art. 7(3) symmetric withdrawal (STUB)
 *   - pauseRecipient    — SC-3 ambivalence pause (UX-DR5 5-state machine)
 *
 * STUB rationale:
 *   STORY-2-2 (`voucher-pii-pipeline-backend`) owns the actual Medusa endpoint
 *   that performs `BEGIN; INSERT consent; INSERT audit; INSERT delivery_decision; COMMIT`.
 *   That story has NOT yet landed in main as of this story's worktree HEAD,
 *   so the actions here:
 *     1. Build the audit payload via `buildAuditPayload()`.
 *     2. POST to `${MEDUSA_BACKEND_URL}/store/voucher-pii-consent/<verb>` if
 *        the env var is set; otherwise log a TODO and return a deterministic
 *        success/failure response so UI flows can be exercised end-to-end.
 *   When Story 2-2 lands, REMOVE the STUB branch and require the endpoint.
 *
 * R-NEW-6 — no silent fallback. On audit failure the action returns
 * `{ ok: false, state: 'error-audit-failed' }` and delivery is BLOCKED.
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

const STUB_TODO_MARKER =
  'STORY-2-2-STUB: backend voucher-pii-consent endpoint not yet provisioned;';

function resolveBackendUrl(): string | null {
  return (
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    null
  );
}

async function postAuditAction(
  verb: ConsentAuditAction,
  payload: ReturnType<typeof buildAuditPayload>
): Promise<ConsentActionResult> {
  const backendUrl = resolveBackendUrl();

  // STUB branch — STORY-2-2 not yet landed.
  if (!backendUrl) {
    // eslint-disable-next-line no-console
    console.warn(`${STUB_TODO_MARKER} verb=${verb} payload=`, payload);
    if (verb === 'grant') {
      return { ok: true, state: 'delivery-decision-recorded', auditId: 'stub-audit-id' };
    }
    if (verb === 'withdraw') {
      return { ok: true, state: 'withdrawn', auditId: 'stub-audit-id' };
    }
    return { ok: true, state: 'consent-pending' };
  }

  try {
    const response = await fetch(`${backendUrl}/store/voucher-pii-consent/${verb}`, {
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
    const json = (await response.json()) as { audit_id?: string };
    if (verb === 'grant') {
      return { ok: true, state: 'delivery-decision-recorded', auditId: json.audit_id };
    }
    if (verb === 'withdraw') {
      return { ok: true, state: 'withdrawn', auditId: json.audit_id };
    }
    return { ok: true, state: 'consent-pending', auditId: json.audit_id };
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
