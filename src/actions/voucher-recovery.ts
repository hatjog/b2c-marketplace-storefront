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
import { redirect } from 'next/navigation';

import { sdk } from '@/lib/config';
import { setAuthToken, getCacheTag } from '@/lib/data/cookies';
import { isSupportedLocale, DEFAULT_LOCALE } from '@/i18n/routing';

export type RecoveryResult =
  | { ok: true }
  | { ok: false; state: 'neutral' };

/**
 * Minimum token length (base64url-opaque-32B → ~43 chars unpadded). We accept
 * 32 chars as a conservative floor — anything shorter is rejected before
 * hitting the backend to neutralize brute-force scanning and reduce backend
 * log noise. Story 2.6 re-review HIGH/MEDIUM (M-token-len).
 */
const MIN_TOKEN_LENGTH = 32;
/** Opaque base64url token character set — defence-in-depth alongside length. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

/**
 * Constant-time response delay to neutralize timing-based email-enumeration on
 * the request-new-link path. Story 2.6 re-review HIGH (H-rate-limit).
 */
const REQUEST_LINK_FLOOR_MS = 800;

/**
 * Best-effort in-memory rate limiter for the request-new-link path. Story 2.6
 * re-review HIGH (H-rate-limit). For multi-instance deployments this should be
 * backed by Redis or coordinated with the backend; storefront-side hardening
 * defends against single-instance abuse and timing-channel enumeration.
 */
const requestLinkBuckets = new Map<string, { count: number; windowStart: number }>();
const REQUEST_LINK_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_LINK_MAX_PER_WINDOW = 5;

function rateLimitKey(email: string): string {
  // Keyed by lowercased email only; IP-aware limiting is deferred to backend
  // because Next.js Server Action handlers do not have direct access to the
  // raw request socket in all deployment topologies.
  return email.trim().toLowerCase();
}

function rateLimitAllow(key: string): boolean {
  const now = Date.now();
  const bucket = requestLinkBuckets.get(key);
  if (!bucket || now - bucket.windowStart > REQUEST_LINK_WINDOW_MS) {
    requestLinkBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= REQUEST_LINK_MAX_PER_WINDOW) {
    return false;
  }
  bucket.count += 1;
  return true;
}

/** Light RFC 5322-ish email validation — sharper than `includes('@')`. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

function safeLocale(value: string | null | undefined): string {
  if (typeof value !== 'string') return DEFAULT_LOCALE;
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

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
  // Story 2.6 re-review HIGH (M-token-len): reject tokens shorter than the
  // documented opaque-32B grammar and tokens that don't match base64url
  // alphabet before touching the backend. The neutral failure shape preserves
  // anti-enumeration: clients still get { ok: false, state: 'neutral' }.
  if (!token || token.length < MIN_TOKEN_LENGTH || !TOKEN_PATTERN.test(token)) {
    return { ok: false, state: 'neutral' };
  }

  try {
    // Attempt to exchange the token via the Medusa auth surface.
    // The token acts as a short-lived bearer credential (single-use, TTL ≤ 30 days).
    //
    // Backend contract (Story 4.4 carry-over): the recovery exchange endpoint
    // MUST return the session token in the JSON response body — Set-Cookie-only
    // auth is NOT supported by this storefront handler because cookies set by
    // `sdk.client.fetch` are not surfaced to `nextCookies()` in the same
    // Server Action handler scope. If a future backend wants cookie-only auth,
    // a fetch wrapper that forwards Set-Cookie into `cookies.set(...)` must be
    // added; until then the body-token contract is mandatory.
    const url = `/store/auth/customer/token-exchange`;
    const res = await sdk.client.fetch<{ token?: string }>(url, {
      method: 'POST',
      body: JSON.stringify({ recovery_token: token }),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    });

    const sessionToken = res?.token;
    if (sessionToken) {
      await setAuthToken(sessionToken);
      // Defensive: revalidateTag('') is a no-op in Next.js but emits a dev
      // warning; only call when cache_id cookie is present.
      const customerCacheTag = await getCacheTag('customers');
      if (customerCacheTag) {
        revalidateTag(customerCacheTag);
      }
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
 * Form-action wrapper for the recovery exchange.
 *
 * Used by the recovery landing route's `<form action={...}>` element so the
 * token exchange runs only after an explicit user gesture (click "Continue").
 *
 * Why: email-security scanners (Microsoft Defender SafeLinks, Google Gmail
 * link-prefetch, corporate proxies) routinely issue HTTP GET to magic-link
 * URLs before delivery. If the page auto-exchanged on GET, the scanner would
 * burn the single-use token and the user would land on the neutral
 * "expired or used" state. Gating the exchange behind a POST/form-action
 * prevents that class of false-positive consumption while preserving
 * single-use semantics and anti-enumeration on the failure side.
 *
 * On success: throws via Next.js redirect() to /[locale]/user/vouchers.
 * On failure: redirect back to the recovery route with `?attempted=1` so
 *   the page renders the neutral failure state without re-running the
 *   exchange. The token segment in the URL stays the same (already burnt
 *   on the backend at this point), but the page no longer re-attempts.
 */
export async function exchangeRecoveryTokenForm(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  // Story 2.6 re-review HIGH (H-open-redirect): locale comes from FormData
  // (user-controlled). Without validation `redirect('/' + locale + ...)` is
  // open to scheme-relative bypasses like `locale=//evil.com` → 307 to
  // `//evil.com/user/vouchers`. Validate against SUPPORTED_LOCALES and fall
  // back to DEFAULT_LOCALE on any mismatch.
  const locale = safeLocale(formData.get('locale')?.toString());
  const result = await exchangeRecoveryToken(token);
  if (result.ok) {
    redirect(`/${locale}/user/vouchers`);
  }
  // On failure: redirect to a TOKEN-LESS neutral-state route so the consumed
  // token does not persist in URL / browser history / synced history.
  // Story 2.6 re-review MEDIUM (M-token-persist).
  redirect(`/${locale}/user/recover?attempted=1`);
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
  const start = Date.now();
  // Anti-enumeration: always return ok:true regardless of branch taken.
  // The constant-time floor at the end of the function neutralizes timing
  // differentials between "email known" and "email unknown" paths.
  // Story 2.6 re-review HIGH (H-rate-limit / timing-enumeration).
  try {
    const trimmed = (email ?? '').trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      return { ok: true };
    }

    // Per-email rate limit (best-effort in-process; backend MUST enforce its
    // own canonical limit). 5 requests per 5 minutes per email address.
    if (!rateLimitAllow(rateLimitKey(trimmed))) {
      return { ok: true };
    }

    try {
      await sdk.auth.resetPassword('customer', 'emailpass', { identifier: trimmed });
    } catch {
      // Swallow error — anti-enumeration, caller always shows same success copy.
    }

    return { ok: true };
  } finally {
    // Pad response to a constant floor so timing does not leak whether the
    // backend branched into "send email" (slow) or "skip" (fast).
    const elapsed = Date.now() - start;
    if (elapsed < REQUEST_LINK_FLOOR_MS) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_LINK_FLOOR_MS - elapsed));
    }
  }
}

/**
 * Form-action wrapper for the request-new-link path.
 *
 * Mirrors the v1.5.0 voucher-consent page's no-JS pattern: clients without
 * JavaScript (corporate proxies that strip JS, privacy tools, screen-reader
 * users on older AT) submit this `<form action={...}>` directly so the flow
 * works without client-side React state.
 *
 * Story 2.6 re-review MEDIUM (M-no-js).
 */
export async function requestVoucherRecoveryLinkForm(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const locale = safeLocale(formData.get('locale')?.toString());
  await requestVoucherRecoveryLink(email);
  // Always redirect to the same neutral-state route with a sent=1 flag.
  // Anti-enumeration: no email-existence info encoded in the redirect.
  redirect(`/${locale}/user/recover?sent=1`);
}
