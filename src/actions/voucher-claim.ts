'use server';

/**
 * Story v160-6-1 / v160-cleanup-15c: Recipient claim Server Action.
 *
 * Per Dev Note "Server Action reuse vs new" (T2.2 decision):
 *   v1.5.0 `grantConsent({ token })` is consent-grant semantics (Art. 7);
 *   `claimVoucher({ code })` is the recipient-facing redemption verb. They
 *   are semantically distinct (consent != claim), so we author a NEW action
 *   that posts to the recipient claim endpoint (Mercur 2 backend).
 *
 * cleanup-15c (AC5): stub fallthrough removed — if backend is unavailable,
 * the action returns a structured error. No `{ ok: true }` masquerade.
 *
 * Request includes HMAC-bound idempotency metadata:
 *   idempotency_key = HMAC(secret, code|recipient_session|claimed_at)
 * backend validates the binding on the first claim and on replays.
 *
 * AR45 boundary: `recipient_session` is an opaque client-side UUID — no
 * name/email/phone crosses this boundary. Only code + locale + session UUID.
 *
 * Error codes surfaced to UI:
 *   rate_limited (429) — caller should display retry delay message
 *   replay_mismatch (409) — tampered idempotency key
 *   already_claimed (409 with type=already_claimed) — voucher already used
 *   expired (410) — voucher expired
 *   backend_unavailable — MEDUSA_BACKEND_URL not configured
 */

import { revalidatePath } from 'next/cache';
import { createHmac, randomUUID } from 'crypto';

export type ClaimVoucherState =
  | 'idle'
  | 'claim-pending'
  | 'claimed'
  | 'error-claim-failed'
  | 'error-rate-limited'
  | 'error-already-claimed'
  | 'error-expired'
  | 'error-replay-mismatch';

export interface ClaimVoucherResult {
  ok: boolean;
  state: ClaimVoucherState;
  error?: string;
  /** Seller handle for post-claim redirect target. */
  seller_handle?: string;
  /** Seconds to wait before retry (present on rate_limited). */
  retry_after?: number;
}

function resolveBackendUrl(): string | null {
  return (
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    null
  );
}

function resolveClaimBindingSecret(): string | null {
  return process.env.GP_VOUCHER_CLAIM_HMAC_SECRET ?? process.env.JWT_SECRET ?? null;
}

function computeClaimBinding(
  code: string,
  recipientSession: string,
  claimedAt: string
): string | null {
  const secret = resolveClaimBindingSecret();
  if (!secret) return null;
  if (code.includes('|') || recipientSession.includes('|')) return null;

  return createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(`${code}|${recipientSession}|${claimedAt}`, 'utf8')
    .digest('hex');
}

export async function claimVoucher(formData: FormData): Promise<ClaimVoucherResult> {
  const code = String(formData.get('code') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'pl').trim();
  // recipient_session: opaque client-supplied UUID (no PII — AR45 boundary)
  const recipientSession = String(formData.get('recipient_session') ?? randomUUID()).trim();

  if (!code) {
    return { ok: false, state: 'error-claim-failed', error: 'missing-code' };
  }

  const backendUrl = resolveBackendUrl();

  if (!backendUrl) {
    // AC5: no stub fallthrough — surface a proper error when backend is unconfigured.
    // eslint-disable-next-line no-console
    console.error('[voucher-claim] MEDUSA_BACKEND_URL is not configured; claim aborted.');
    return {
      ok: false,
      state: 'error-claim-failed',
      error: 'backend_unavailable'
    };
  }

  const claimedAt = new Date().toISOString();
  const idempotencyKey = computeClaimBinding(code, recipientSession, claimedAt);

  if (!idempotencyKey) {
    return {
      ok: false,
      state: 'error-claim-failed',
      error: 'binding_secret_unavailable'
    };
  }

  try {
    const response = await fetch(
      `${backendUrl}/store/vouchers/${encodeURIComponent(code)}/claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          recipient_session: recipientSession,
          idempotency_key: idempotencyKey,
          claimed_at: claimedAt,
        }),
        cache: 'no-store'
      }
    );

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? '60');
      return {
        ok: false,
        state: 'error-rate-limited',
        error: 'rate_limited',
        retry_after: retryAfter,
      };
    }

    if (response.status === 409) {
      let body: { type?: string } = {};
      try { body = await response.json(); } catch { /* ignore */ }
      if (body?.type === 'replay_mismatch') {
        return { ok: false, state: 'error-replay-mismatch', error: 'replay_mismatch' };
      }
      return { ok: false, state: 'error-already-claimed', error: 'already_claimed' };
    }

    if (response.status === 410) {
      return { ok: false, state: 'error-expired', error: 'expired' };
    }

    if (!response.ok) {
      return {
        ok: false,
        state: 'error-claim-failed',
        error: `backend returned ${response.status}`
      };
    }

    const json = (await response.json()) as { seller_handle?: string };
    revalidatePath(`/${locale}/voucher/${code}`, 'page');
    return { ok: true, state: 'claimed', seller_handle: json.seller_handle };
  } catch (error) {
    return {
      ok: false,
      state: 'error-claim-failed',
      error: error instanceof Error ? error.message : 'unknown claim failure'
    };
  }
}
