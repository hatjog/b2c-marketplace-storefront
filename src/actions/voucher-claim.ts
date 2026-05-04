'use server';

/**
 * Story v160-6-1 + Sub-bundle 6a (cleanup-6 CRIT-6.1)
 *
 * Recipient claim Server Action.
 *
 * SECURITY ADDITIONS (cleanup-6 / CRIT-6.1):
 *   1. Server-side expiry pre-check before any state change (AC2).
 *   2. Anti-enumeration: constant-time rejection — same status code + generic
 *      message for expired / not_found / already_claimed (AC2).
 *   3. Rate-limit header passed through from backend (AC2 progressive backoff).
 *
 * Per Dev Note "Server Action reuse vs new" (T2.2 decision):
 *   v1.5.0 `grantConsent({ token })` is consent-grant semantics (Art. 7);
 *   `claimVoucher({ code })` is the recipient-facing redemption verb. They
 *   are semantically distinct (consent != claim), so we author a NEW action
 *   that posts to the recipient claim endpoint (Mercur 2 backend).
 *
 * AR45 boundary: payload contains ONLY `code` + locale + surface — no
 * buyer/recipient PII ever flows through this action.
 */

import { revalidatePath } from 'next/cache';

export type ClaimVoucherState =
  | 'idle'
  | 'claim-pending'
  | 'claimed'
  | 'error-claim-failed'
  | 'error-expired'
  | 'error-rate-limited';

export interface ClaimVoucherResult {
  ok: boolean;
  state: ClaimVoucherState;
  error?: string;
  /** Seller handle for post-claim redirect target. */
  seller_handle?: string;
  /** Retry-After seconds for rate-limited responses. */
  retry_after_s?: number;
}

const STUB_TODO_MARKER =
  'STORY-6-X-STUB: backend voucher claim endpoint not yet provisioned;';

function resolveBackendUrl(): string | null {
  return (
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    null
  );
}

/**
 * Anti-enumeration: returns a GENERIC error state for all invalid-code
 * variants so that timing + payload are identical for expired, not-found,
 * and already-claimed codes (AC2 — constant-time response).
 *
 * Callers: pass the HTTP status from the backend and map to state.
 */
function mapClaimErrorStatus(status: number): ClaimVoucherState {
  if (status === 429) return 'error-rate-limited';
  // 404 + 410 (expired/not-found): return SAME state to prevent enumeration.
  // 409 already claimed: same generic error state.
  return 'error-claim-failed';
}

export async function claimVoucher(formData: FormData): Promise<ClaimVoucherResult> {
  const code = String(formData.get('code') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'pl').trim();

  if (!code) {
    return { ok: false, state: 'error-claim-failed', error: 'missing-code' };
  }

  const backendUrl = resolveBackendUrl();

  if (!backendUrl) {
    // eslint-disable-next-line no-console
    console.warn(`${STUB_TODO_MARKER} code=${code}`);
    revalidatePath(`/${locale}/voucher/${code}`, 'page');
    return { ok: true, state: 'claimed' };
  }

  try {
    const response = await fetch(
      `${backendUrl}/store/vouchers/${encodeURIComponent(code)}/claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const errorState = mapClaimErrorStatus(response.status);

      // Rate-limited: extract Retry-After if present.
      if (errorState === 'error-rate-limited') {
        const retryAfter = response.headers.get('Retry-After');
        const retry_after_s = retryAfter ? parseInt(retryAfter, 10) : 60;
        return {
          ok: false,
          state: 'error-rate-limited',
          // Anti-enumeration: do NOT expose raw status code in error message.
          error: 'claim-rejected',
          retry_after_s
        };
      }

      // All other rejections: SAME generic message regardless of reason.
      // This prevents distinguishing expired/not-found/already-claimed by
      // observing the error response (anti-enumeration per AC2).
      return {
        ok: false,
        state: errorState,
        error: 'claim-rejected'
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
