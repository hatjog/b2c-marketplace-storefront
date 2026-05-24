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
 * v1.9.0 wf5 (closes CC-1 F-CC1-005 HIGH): the `connect-src` directive used
 * to whitelist `api.mercurjs.com` (Mercur upstream marketing API) which is
 * NOT the origin the storefront actually talks to. In production the
 * storefront calls the GP-owned BonBeauty backend host (resolved via
 * `MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_MEDUSA_BACKEND_URL`); CSP enforce mode
 * would block every SDK call (cart, payment, status polling, etc.) with
 * silent fetch failures. The new directive list:
 *   - Removes the wrong `api.mercurjs.com` whitelist.
 *   - Adds a build-time-injected `${MEDUSA_BACKEND_ORIGIN}` placeholder
 *     resolved by `resolveCspDirectiveList()` at runtime from
 *     `NEXT_PUBLIC_MEDUSA_BACKEND_URL` / `MEDUSA_BACKEND_URL`.
 *   - For dev (`'self'` localhost setups) the placeholder resolves to the
 *     dev origin so local checkout works under enforce mode too.
 */
function resolveMedusaBackendOriginsForCsp(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    process.env.MEDUSA_BACKEND_URL,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const origins = new Set<string>();
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      origins.add(`${url.protocol}//${url.host}`);
    } catch {
      // ignore malformed values; fall back to 'self' coverage
    }
  }
  return Array.from(origins);
}

/**
 * 10 CSP directives per D-64 (architecture.md:328) plus Stripe Elements
 * runtime origins required by checkout.
 * Tailwind requires `'unsafe-inline'` for styles only — NOT scripts.
 * `frame-ancestors 'none'` blocks clickjacking.
 */
export function buildCspDirectiveList(
  medusaBackendOrigins: readonly string[] = resolveMedusaBackendOriginsForCsp()
): readonly string[] {
  const backendConnectFragments = medusaBackendOrigins.length
    ? ' ' + medusaBackendOrigins.join(' ')
    : '';
  return [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' https: blob: data:",
    // v1.9.0 wf5 F-CC1-005 fix: `connect-src` whitelists GP backend origin
    // (resolved from MEDUSA_BACKEND_URL) instead of the wrong
    // `api.mercurjs.com`. Stripe edge origins (r/m/q.stripe.com) preserved.
    `connect-src 'self' https://*.sentry.io https://*.posthog.com https://api.stripe.com https://r.stripe.com https://m.stripe.com https://q.stripe.com${backendConnectFragments}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
}

/**
 * Back-compat: `CSP_DIRECTIVE_LIST` and `CSP_DIRECTIVES` are evaluated at
 * module-load time using whatever env vars are set then. For runtime
 * resolution under `next.config.ts` `headers()` use `buildCspDirectiveList()`.
 */
export const CSP_DIRECTIVE_LIST: readonly string[] = buildCspDirectiveList();

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
