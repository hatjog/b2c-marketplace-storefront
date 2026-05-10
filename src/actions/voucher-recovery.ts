'use server';

/**
 * Voucher recovery Server Actions — Story 2.6 (v1.7.0).
 *
 * exchangeRecoveryToken — exchanges a magic-link opaque token for a customer
 *   session. On success: calls setAuthToken with the returned JWT and returns
 *   {ok: true}. On failure (expired, already-used, malformed): returns
 *   {ok: false, state: 'neutral'} — anti-enumeration: all error variants
 *   produce the same state id so the UI cannot distinguish between
 *   "never existed", "expired" or "already used" (NFR16).
 *
 * requestVoucherRecoveryLink — issues a new recovery email for a given email
 *   address. Reuses the same email-pass identity provider as
 *   sendResetPasswordEmail to avoid a parallel auth strategy (Anti-pattern:
 *   Parallel auth strategy). Backend may treat the recovery-link request
 *   identically to password-reset-link request in v1.7.0 baseline; if a
 *   dedicated endpoint surfaces in Story 4.4, wire it there.
 *
 * Security invariants (NFR16):
 *   - Token is NEVER logged (no console.log/console.error with token).
 *   - Token is NEVER echoed in redirect URL or response body.
 *   - Anti-enumeration: error state is always 'neutral', never 'expired',
 *     'used' or 'unknown' — caller must use a single i18n key
 *     `voucher.recovery.error.neutral`.
 *
 * Story 4.4 coordination: if the backend exposes a dedicated
 * /store/voucher-recovery/exchange endpoint (TF-208 / TF-209), replace
 * the sdk.auth.login path below with that endpoint. Until then, we use
 * the existing emailpass token-exchange surface as the recovery mechanism,
 * which means the backend voucher-recovery token MUST be issued in the same
 * format as an emailpass reset token. This is a known gap — document in
 * story 4.4 carry-over.
 */

import { revalidateTag } from 'next/cache';

import { sdk } from '@/lib/config';
import { setAuthToken, getCacheTag } from '@/lib/data/cookies';

export type RecoveryResult =
  | { ok: true }
  | { ok: false; state: 'neutral' };

/**
 * Exchange an opaque magic-link recovery token for a customer session.
 *
 * The token is treated as a one-time-use bearer credential. Storefront
 * NEVER decodes, inspects or logs the token — the backend exchange call is
 * the only validation point (Anti-pattern: Token logging).
 *
 * On success: sets auth cookie and returns {ok: true} so the page can
 * redirect to /user/vouchers (or the originally requested voucher target).
 *
 * On failure: returns {ok: false, state: 'neutral'} — caller renders the
 * single neutral state copy (voucher.recovery.error.neutral) regardless of
 * actual backend error code so no token-existence information leaks.
 */
export async function exchangeRecoveryToken(token: string): Promise<RecoveryResult> {
  if (!token || token.length < 8) {
    return { ok: false, state: 'neutral' };
  }

  try {
    // Attempt to exchange the token via the Medusa auth surface.
    // The token acts as a short-lived bearer credential (single-use, TTL ≤ 30 days).
    // Story 4.4 carry-over: if a dedicated voucher-recovery/exchange endpoint
    // is provisioned, swap sdk.client.fetch path here (TF-208 / TF-209).
    const url = `/store/auth/customer/token-exchange`;
    const res = await sdk.client.fetch<{ token?: string }>(url, {
      method: 'POST',
      body: JSON.stringify({ recovery_token: token }),
      headers: { 'Content-Type': 'application/json' }
    });

    const sessionToken = res?.token;
    if (sessionToken) {
      await setAuthToken(sessionToken);
      const customerCacheTag = await getCacheTag('customers');
      revalidateTag(customerCacheTag);
      return { ok: true };
    }

    return { ok: false, state: 'neutral' };
  } catch {
    // Any backend error (expired, used, malformed) → neutral anti-enumeration state.
    // DO NOT log token or error details that could expose token existence.
    return { ok: false, state: 'neutral' };
  }
}

/**
 * Request a new recovery link by email address.
 *
 * Reuses the emailpass identity provider (same as sendResetPasswordEmail in
 * customer.ts). Intentionally anti-enumeration: always returns {ok: true}
 * so no email-existence information is leaked to the caller (UX copy:
 * "If this email has an account, a recovery link will be sent.").
 */
export async function requestVoucherRecoveryLink(email: string): Promise<{ ok: true }> {
  if (!email || !email.includes('@')) {
    // Anti-enumeration: return ok:true even for invalid email.
    return { ok: true };
  }

  try {
    await sdk.auth.resetPassword('customer', 'emailpass', { identifier: email });
  } catch {
    // Swallow error — anti-enumeration, caller always shows same success copy.
  }

  return { ok: true };
}
