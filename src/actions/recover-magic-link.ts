'use server';

/**
 * Magic-link recovery Server Actions — Story 5.3 (W3-05 / W3-06).
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review CRITICAL P0):
 *   - `requestMagicLinkRecover` (W3-05): client form POSTs email+locale;
 *     server triggers backend recovery email. Always returns enumeration-
 *     neutral success on valid input.
 *   - `verifyMagicLinkRecover` (W3-06): consumes a single-use token,
 *     sets auth cookie, redirects to /[locale]/user/vouchers?welcome=recover.
 *
 * Security invariants:
 *   - Token NEVER appears in console output.
 *   - Token NEVER echoed in redirect URL or response payload.
 *   - Failure path redirects to token-less route so consumed/expired token
 *     does not persist in browser history / link share / mail-scanner.
 */

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

import { setAuthToken, getCacheTag } from '@/lib/data/cookies';
import {
  requestRecoverMagicLink,
  verifyRecoverMagicLink
} from '@/lib/auth/recover-magic-link';

export type RequestMagicLinkRecoverState = {
  status: 'idle' | 'submitted' | 'invalid' | 'network_error';
};

/**
 * useFormState-friendly request action.
 *
 * Status semantics:
 *   - `idle` initial state.
 *   - `submitted` always-positive UX confirmation (anti-enumeration).
 *   - `invalid` invalid email format (client-side validation should prevent).
 *   - `network_error` transient backend / network failure.
 */
export async function requestMagicLinkRecover(
  _prev: RequestMagicLinkRecoverState,
  formData: FormData
): Promise<RequestMagicLinkRecoverState> {
  const email = String(formData.get('email') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'pl').trim() || 'pl';

  const result = await requestRecoverMagicLink({ email, locale });
  if (!result.ok) {
    return { status: result.code === 'INVALID_INPUT' ? 'invalid' : 'network_error' };
  }
  return { status: 'submitted' };
}

/**
 * Token-verify form action (W3-06). Triggered by an explicit user gesture
 * (click-to-continue button) to prevent email-scanner / link-prefetch
 * single-use consumption.
 *
 * Success: sets auth cookie + redirects to /[locale]/user/vouchers?welcome=recover.
 * Failure: redirects to /[locale]/user/recover?attempted=1 (token-less,
 * mirrors Story 2.6 v1.7.0 NFR16 pattern).
 */
export async function verifyMagicLinkRecoverForm(formData: FormData): Promise<never> {
  const token = String(formData.get('token') ?? '');
  const locale = String(formData.get('locale') ?? 'pl') || 'pl';

  const result = await verifyRecoverMagicLink({ token });

  if (!result.valid) {
    redirect(`/${locale}/user/recover?attempted=1`);
  }

  await setAuthToken(result.authToken);
  try {
    revalidateTag(await getCacheTag('customer'));
  } catch {
    // best-effort cache bust; ignore failures
  }

  redirect(`/${locale}/user/vouchers?welcome=recover`);
}
