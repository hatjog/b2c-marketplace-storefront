'use server';

/**
 * Story v160-6-1: Recipient claim Server Action.
 *
 * Per Dev Note "Server Action reuse vs new" (T2.2 decision):
 *   v1.5.0 `grantConsent({ token })` is consent-grant semantics (Art. 7);
 *   `claimVoucher({ code })` is the recipient-facing redemption verb. They
 *   are semantically distinct (consent != claim), so we author a NEW action
 *   that posts to the recipient claim endpoint (Mercur 2 backend).
 *
 * STUB rationale (mirrors voucher-consent.ts pattern):
 *   When MEDUSA_BACKEND_URL is unset, the action returns a deterministic
 *   success result so UI flows can be exercised end-to-end. Production
 *   backend endpoint authoring is OUT OF 6.1 scope (Story 6.x territory).
 *
 * AR45 boundary: payload contains ONLY `code` + locale + surface — no
 * buyer/recipient PII ever flows through this action.
 */

import { revalidatePath } from 'next/cache';

export type ClaimVoucherState =
  | 'idle'
  | 'claim-pending'
  | 'claimed'
  | 'error-claim-failed';

export interface ClaimVoucherResult {
  ok: boolean;
  state: ClaimVoucherState;
  error?: string;
  /** Seller handle for post-claim redirect target. */
  seller_handle?: string;
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
