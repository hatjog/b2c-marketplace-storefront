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
 *
 * v1.10.0 D-104 / FR-D.2 / Story 4.4: `connect-src` also allows
 * `https://*.maptiler.com` for MapTiler vector + raster tile loading from
 * the GP-owned style ID.
 *
 * Coupling note (Story 4.4 INFO-1 review): MapTiler raster sprite/glyph PNGs
 * are covered by the permissive `img-src 'self' https: blob: data:` directive
 * — NIE zawężać `img-src` do explicit originów bez równoczesnego audytu
 * MapTiler tile endpointów, inaczej zepsujesz raster tile loading bez sygnału
 * w `connect-src` testach.
 *
 * Forward-looking (Story 4.4 INFO-2 review): jeżeli future story przełączy
 * `SellerMap` z `react-leaflet` (raster) na MapLibre GL JS (vector tiles),
 * MapLibre tworzy blob workers — wtedy dopisać `worker-src 'self' blob:`
 * (lub `child-src 'self' blob:` fallback) do directive listy. Aktualny stack
 * (raster) workerów nie używa.
 */
export function buildCspDirectiveList(
  medusaBackendOrigins: readonly string[] = resolveMedusaBackendOriginsForCsp(),
  isDev: boolean = process.env.NODE_ENV === 'development'
): readonly string[] {
  const backendConnectFragments = medusaBackendOrigins.length
    ? ' ' + medusaBackendOrigins.join(' ')
    : '';
  // v1.14.0 dev-hydration fix: `next dev` bundles client code through
  // eval/new Function (fast rebuilds + source maps), so under the enforce-mode
  // policy the browser throws EvalError, React never hydrates and every button
  // on the page is dead SSR markup. Next.js's own CSP guidance is to allow
  // 'unsafe-eval' in development only. Gated on NODE_ENV (never NEXT_PUBLIC_*,
  // which would bake the dev policy into production client bundles); prod and
  // test directive lists stay byte-identical to the pre-fix policy.
  const devScriptFragments = isDev ? " 'unsafe-eval'" : '';
  // v1.11.0 Gate A (ra-1 live-render finding 2026-05-31): the TalkJS chat widget
  // loads https://cdn.talkjs.com/talk.js, talks to https://api.talkjs.com over a
  // wss://*.talkjs.com websocket, and renders its UI in an https://*.talkjs.com
  // iframe. Under enforce mode the prior directive list blocked all of these (the
  // live-render gate B1 caught the script-src block). Add the TalkJS origins to the
  // matching directives. img-src `https:` already covers TalkJS avatars; style-src
  // `'unsafe-inline'` already covers its injected styles. media-src is added because
  // TalkJS loads notification sounds from cdn.talkjs.com/__assets/*.mp3 (a live re-run
  // after the script-src fix surfaced the media block — there was no explicit media-src,
  // so it fell back to default-src 'self').
  return [
    "default-src 'self'",
    `script-src 'self'${devScriptFragments} https://js.stripe.com https://cdn.talkjs.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' fonts.gstatic.com https://cdn.talkjs.com",
    "img-src 'self' https: blob: data:",
    "media-src 'self' https://cdn.talkjs.com",
    // v1.9.0 wf5 F-CC1-005 fix: `connect-src` whitelists GP backend origin
    // (resolved from MEDUSA_BACKEND_URL) instead of the wrong
    // `api.mercurjs.com`. Stripe edge origins (r/m/q.stripe.com) preserved.
    // v1.10.0 D-104 / Story 4.4 adds MapTiler without broad `connect-src *`.
    `connect-src 'self' https://*.sentry.io https://*.posthog.com https://api.stripe.com https://r.stripe.com https://m.stripe.com https://q.stripe.com https://*.maptiler.com https://api.talkjs.com wss://*.talkjs.com${backendConnectFragments}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.talkjs.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
}

/**
 * Per-request nonce variant of {@link buildCspDirectiveList}.
 *
 * v1.10.0 ra-1 (clean-boot / live-render fix): a static `script-src 'self'`
 * (no nonce, no `'unsafe-inline'`) emitted from `next.config.ts` `headers()`
 * BLOCKS Next.js App Router's own inline hydration scripts under enforce mode
 * (prod default) → blank page in any real browser. The fix is a per-request
 * nonce injected by `src/middleware.ts` into BOTH the request CSP header (so
 * Next auto-stamps the same nonce onto its inline `<script>` tags) and the
 * response CSP header (what the browser enforces). Everything except
 * `script-src` is identical to {@link buildCspDirectiveList}; `'unsafe-inline'`
 * is deliberately NOT added (it would defeat the policy). `js.stripe.com`
 * stays host-allowlisted; `'self'` still covers Next's external chunks.
 */
export function buildCspDirectiveListWithNonce(
  nonce: string,
  medusaBackendOrigins: readonly string[] = resolveMedusaBackendOriginsForCsp(),
  isDev: boolean = process.env.NODE_ENV === 'development'
): readonly string[] {
  // v1.14.0 dev-hydration fix: this nonce variant is what src/middleware.ts
  // actually emits, so the dev-only 'unsafe-eval' MUST appear here too — the
  // nonce stays (App Router inline hydration scripts still need it) and
  // 'unsafe-eval' is additive, dev-only. See buildCspDirectiveList.
  const devScriptFragments = isDev ? " 'unsafe-eval'" : '';
  return buildCspDirectiveList(medusaBackendOrigins, isDev).map((directive) =>
    directive.startsWith('script-src ')
      ? `script-src 'self' 'nonce-${nonce}'${devScriptFragments} https://js.stripe.com https://cdn.talkjs.com`
      : directive
  );
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
