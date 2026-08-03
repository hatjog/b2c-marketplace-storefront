/**
 * Story 1.6 (FR1.7 / AC3) — third-party header allowlist.
 *
 * GP's multi-tenant model attaches internal context headers
 * (`x-market-id`, `x-publishable-api-key`, `x-customer-id` — lowercase per
 * HTTP spec, architecture.md:1073) to backend requests. These headers MUST
 * NEVER reach a third-party origin: leaking `x-market-id` to an external
 * domain discloses tenant context, and the publishable key / customer id are
 * internal coupling not meant for anyone but our Medusa backend.
 *
 * This guard is defense-in-depth (a *contract*, not a reaction to a current
 * leak): today the storefront issues no direct fetch to a Stripe host with
 * our headers attached — Stripe.js performs its own XHR outside our fetch
 * wrapper. The guard ensures any *future* callsite that points the central
 * fetch helper at a Stripe host cannot exfiltrate internal headers.
 *
 * Host matching is suffix-safe (`=== 'stripe.com'` OR `.endsWith('.stripe.com')`)
 * — NOT `url.includes('stripe')` — so a hostile host like
 * `stripe.com.evil.example` is correctly treated as NON-Stripe (it is not our
 * domain either, so it keeps the default behaviour; the point is it must not
 * be misclassified as a trusted Stripe origin and silently allowed).
 */

/**
 * Internal multi-tenant headers that must be stripped before a request
 * reaches a third-party (non-backend) origin. Compared case-insensitively.
 */
export const INTERNAL_MULTITENANT_HEADERS: readonly string[] = [
  'x-market-id',
  'x-publishable-api-key',
  'x-customer-id'
] as const;

/**
 * Suffix-safe Stripe host check.
 *
 * Returns true ONLY for the apex `stripe.com` or a real subdomain
 * (`js.stripe.com`, `api.stripe.com`, `m.stripe.com`, `r.stripe.com`,
 * `q.stripe.com`, `hooks.stripe.com`, ...). Bypass strings such as
 * `stripe.com.evil.example` or `notstripe.com` return false.
 */
export function isStripeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'stripe.com' || host.endsWith('.stripe.com');
}

/**
 * Returns true when the URL targets a Stripe host. Unparseable input is
 * treated as NON-Stripe (we cannot confirm a trusted Stripe origin, so the
 * caller keeps its default behaviour rather than wrongly trusting it).
 */
export function isStripeUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return isStripeHost(hostname);
}

/**
 * Strip internal multi-tenant headers from `headers` IFF `url` targets a
 * Stripe host. For our own Medusa backend (or any non-Stripe URL) the headers
 * are returned unchanged — this keeps `x-publishable-api-key` flowing to the
 * backend and has zero impact on market-isolation behaviour.
 *
 * Header keys are matched case-insensitively (HTTP header names are
 * case-insensitive); a fresh object is returned (no mutation of the input).
 */
export function stripInternalHeadersForThirdParty<
  T extends Record<string, unknown>
>(url: string, headers: T): Partial<T> {
  if (!isStripeUrl(url)) {
    return { ...headers };
  }

  const blocked = new Set(INTERNAL_MULTITENANT_HEADERS);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (blocked.has(key.toLowerCase())) {
      continue;
    }
    result[key] = value;
  }
  return result as Partial<T>;
}
