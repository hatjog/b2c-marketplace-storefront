/**
 * D-64 (architecture.md:328) — Content-Security-Policy directive policy
 * + env-var toggle resolver for `next.config.ts` `headers()`.
 *
 * 4th security layer (defense-in-depth z dual sanitization library +
 * ESLint XSS bans + frame-ancestors anti-clickjacking).
 *
 * R3-AI-07 — env var `STOREFRONT_CSP_MODE=enforce|report-only` flips header
 * name without redeploy (~30s config-only cycle; NIE full redeploy).
 * Invalid value → boot fail-fast (NIE silently default).
 *
 * Single source of truth: directive list and header-name resolver are
 * imported by `next.config.ts` AND `src/__tests__/csp-header.test.ts`
 * to keep the policy identical between modes (only header name flips).
 */

/**
 * 10 CSP directives per D-64 (architecture.md:328) plus Stripe Elements
 * runtime origins required by checkout.
 * Tailwind requires `'unsafe-inline'` for styles only — NOT scripts.
 * `frame-ancestors 'none'` blocks clickjacking.
 */
export const CSP_DIRECTIVE_LIST: readonly string[] = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' fonts.gstatic.com",
  "img-src 'self' https: blob: data:",
  "connect-src 'self' https://*.sentry.io https://*.posthog.com https://api.mercurjs.com https://api.stripe.com https://r.stripe.com https://m.stripe.com https://q.stripe.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
] as const;

/**
 * Pre-joined directive string ready for the CSP header value.
 * Identical between enforce and report-only modes.
 */
export const CSP_DIRECTIVES: string = CSP_DIRECTIVE_LIST.join('; ');

export type CspHeaderName = 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only';

/**
 * Resolves the CSP header name from the `STOREFRONT_CSP_MODE` env var.
 *
 * - `enforce` (default) → `Content-Security-Policy` (browser blocks)
 * - `report-only`       → `Content-Security-Policy-Report-Only` (browser logs)
 * - any other value     → throws (fail-fast at boot per AC #2)
 */
export function resolveCspHeaderName(
  mode: string | undefined = process.env.STOREFRONT_CSP_MODE
): CspHeaderName {
  const resolved = mode ?? 'enforce';
  if (resolved === 'enforce') {
    return 'Content-Security-Policy';
  }
  if (resolved === 'report-only') {
    return 'Content-Security-Policy-Report-Only';
  }
  throw new Error(`STOREFRONT_CSP_MODE must be 'enforce' or 'report-only', got: ${resolved}`);
}
