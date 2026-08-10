import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import deMessages from './messages/de.json';
import enMessages from './messages/en.json';
import plMessages from './messages/pl.json';
import uaMessages from './messages/ua.json';
import { loadSlugRedirectsForNext } from './scripts/slug-redirects';
import { generateLocaleRewrites } from './src/i18n/locale-rewrite-rules';

const distDir = process.env.GP_STOREFRONT_DIST_DIR || '.next';

/**
 * Story 3.1 (v1.15.0), AC1/AC3 — allowlista `next/image` dla LOKALNYCH backendow musi
 * isc za tym samym adresem, co reszta adresow docelowych stacka.
 *
 * ZMIERZONE 2026-08-10: wpis ponizej byl literalnym `hostname: 'localhost'`, mimo ze
 * jego wlasny komentarz nazywal go „env-driven origin". Po podniesieniu stacka pod
 * adresem LAN (`GP_STOREFRONT_BASE_HOST`, czyli DOKLADNIE ta konfiguracja, ktorej
 * wymaga sesja bramkowa Epiku 6 na telefonie) `MEDUSA_BACKEND_URL` i `PAYLOAD_API_URL`
 * wskazywaly juz LAN, a allowlista wciaz `localhost` — wiec KAZDA miniatura produktu
 * i kazdy obraz z portalu rzucal `Invalid src prop`, a `/pl` zwracalo **HTTP 500**.
 *
 * Zrodlem jest ta sama zmienna co dla pozostalych adresow — zadna nowa nie powstaje.
 * Zwezenie ze Story 2.5 / ADR-179 zostaje nietkniete: wyprowadzamy KONKRETNE hosty,
 * nigdy wildcard. Bez ustawionych zmiennych wynik to dokladnie `http://localhost`,
 * czyli zachowanie sprzed tej zmiany.
 */
const localBackendImageOrigins = (() => {
  const sources = [
    process.env.MEDUSA_BACKEND_URL,
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    process.env.PAYLOAD_API_URL,
    'http://localhost'
  ];
  const byOrigin = new Map<string, { protocol: 'http' | 'https'; hostname: string }>();
  for (const source of sources) {
    if (!source) continue;
    let parsed: URL;
    try {
      parsed = new URL(source);
    } catch {
      continue; // wartosc nie-URL nie moze cicho poszerzyc allowlisty
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    const protocol = parsed.protocol.slice(0, -1) as 'http' | 'https';
    const key = `${protocol}://${parsed.hostname}`;
    if (!byOrigin.has(key)) byOrigin.set(key, { protocol, hostname: parsed.hostname });
  }
  return [...byOrigin.values()];
})();

/**
 * Story 3.1 — origin `apps/web` dla przekierowania `/:locale/gp-dashboard/**`.
 * Host bierzemy z tego samego nosnika co wyzej; port `apps/web` (3000) jest staly
 * i nie zalezy od adresu bazowego. Bez zmiennych wynik to `http://localhost:3000`.
 */
const gpDashboardOrigin = (() => {
  const source =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL;
  if (!source) return 'http://localhost:3000';
  try {
    return `${new URL(source).protocol}//${new URL(source).hostname}:3000`;
  } catch {
    return 'http://localhost:3000';
  }
})();

const nextConfig: NextConfig = {
  distDir,
  turbopack: {
    root: __dirname
  },
  watchOptions: {
    pollIntervalMs: 1000
  },
  output: "standalone",
  trailingSlash: false,
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  images: {
    // Category images (metadata.gp.images, ADR-159/AD-10): bonbeauty source
    // refs are relative (`assets/…`) and resolve at render time to the
    // SAME-ORIGIN route `/api/runtime-market-assets/<marketId>/assets/**`
    // (src/lib/category-images.ts → resolveMarketAssetUrl). Same-origin paths
    // bypass remotePatterns, so the real remote-origin set contributed by
    // category images is EMPTY — no entry below originates from them. Story
    // 3.2 builds its source↔allowlist drift-test (AD-12) on this invariant.
    // TIGHTEN-PASS DONE — Story 2.5 (v1.15.0, FR-14c), ADR-179.
    // The `{protocol: 'https', hostname: '**'}` catch-all that used to close
    // this array is GONE. It let ANY host on the internet be fetched
    // server-side by `/_next/image`, cached, and re-served from our own
    // origin — an SSRF-shaped surface plus free CDN/content hosting under our
    // domain. ADR-159 §6 flagged it; this story removed it.
    //
    // EVERY entry below names its consumer. An entry with no consumer is a
    // defect, not a spare — the eight pre-2.5 entries included four that
    // existed only as `<link rel="preconnect">` leftovers from the Mercur
    // upstream demo and two (`api-sandbox.mercurjs.com`,
    // `mercur-testing.up.railway.app`) with zero references anywhere in the
    // repo. They were removed, not carried.
    //
    // ADDING AN ENTRY: derive it, do not guess. Run
    //   python3 _grow/tools/validate_products_catalog.py --root . --report-origins
    // and add only what it reports. The same validator FAILS (exit 1) on a
    // config-layer origin missing here, and WARNS if an origin is covered
    // only by a re-introduced catch-all.
    //
    // Category images (metadata.gp.images, ADR-159/AD-10) with relative refs
    // resolve to the SAME-ORIGIN route `/api/runtime-market-assets/**` and
    // bypass remotePatterns entirely, so they contribute an EMPTY remote set
    // (ADR-159 §4). That invariant is an input to the AD-12 drift-test —
    // do not delete it while tidying.
    remotePatterns: [
      {
        // Vendor/salon imagery + category photo_url across market.yaml
        // (bonevent, bongarden, mercur, testmarketb) and products.yaml
        // (testmarketb) — 54 refs. Consumers: SellerCard, SellerHero,
        // SellerTabs gallery, SellerAvatar, CategoryCard.
        protocol: 'https',
        hostname: 'images.unsplash.com'
      },
      {
        // Vendor/salon imagery in bonbeauty market.yaml — `photo_url`,
        // `gallery_urls[]`, `gallery[].url` (22 refs). Same consumers.
        protocol: 'https',
        hostname: 'images.pexels.com'
      },
      // NOT here, on purpose: `kremidotyk.pl`. It was the one remaining
      // config-layer origin, but its single ref
      // (`.../kremidotyk-studio-profile.jpg`) 301s to www.kremidotyk.pl and
      // 404s there — measured, not assumed. An allowlist entry whose only
      // consumer is a dead ref is surface with no benefit, so the ref was
      // removed from the source (gp-ops/markets/bonbeauty/**) instead. Same
      // treatment as the 186 `elements.envato.com` refs, which were
      // marketplace PAGES (text/html) that `/_next/image` already rejected.
      // Env-driven origin, gp-dev/gp-test form. Covers BOTH local backends:
      // Medusa uploads (`MEDUSA_BACKEND_URL` -> `<origin>/static/**`,
      // localhost:9002) and Payload portal media (`PAYLOAD_API_URL` ->
      // `<origin>/api/media/file/**`, localhost:9003) — homepage blocks,
      // blog cards and product thumbnails all route through them.
      //
      // A NON-LOCAL instance moves both origins somewhere no artifact in
      // this repo can enumerate (S3 bucket / MinIO / CDN). That origin MUST
      // be added here as an explicit host before that instance ships —
      // deriving the allowlist from gp-dev/gp-test alone is exactly the trap
      // ADR-179 names. Do NOT pre-empt it with `'**.amazonaws.com'`: a
      // whole-provider wildcard is the old catch-all in a smaller box.
      //
      // Story 3.1: te wpisy sa WYPROWADZONE z `MEDUSA_BACKEND_URL` /
      // `PAYLOAD_API_URL` (patrz `localBackendImageOrigins` na gorze pliku), a nie
      // wpisane literalnie — inaczej stack pod adresem LAN zwraca 500 na kazdej
      // stronie z obrazem. Bez zmiennych wynik to `http://localhost`, jak dotad.
      ...localBackendImageOrigins
    ]
  },
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    // Pre-existing ESLint errors (TF-33) — ignored for dev/e2e builds.
    // MUST be resolved before production promotion.
    ignoreDuringBuilds: true
  },
  async headers() {
    // v1.10.0 ra-1: CSP moved to src/middleware.ts so it can carry a
    // per-request nonce. A static header here cannot hold a nonce and would
    // emit a second, no-nonce CSP that still blocks Next's inline hydration
    // scripts (blank page under enforce mode). The STOREFRONT_CSP_MODE
    // enforce/report-only toggle is preserved in the middleware.
    return [];
  },
  async redirects() {
    return [
      {
        // Story 3.1: adres DOCELOWY przegladarki, wiec idzie za tym samym nosnikiem
        // co reszta. Zaszyty `localhost:3000` na telefonie znaczy „ten telefon".
        source: '/:locale/gp-dashboard/:path*',
        destination: `${gpDashboardOrigin}/gp-dashboard/:path*`,
        permanent: false,
      },
      ...loadSlugRedirectsForNext(),
    ];
  },
  async rewrites() {
    return generateLocaleRewrites('pl', {
      pl: plMessages.routes,
      en: enMessages.routes,
      ua: uaMessages.routes,
      de: deMessages.routes
    });
  },
  webpack(config) {
    // @medusajs/ui imports @internationalized/date without declaring it as a
    // dependency. Resolve it explicitly from the storefront's own node_modules.
    // See: specs/operator/pre-promote-smoke-checklist.md (e2e unblock)
    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@internationalized/date': path.resolve(
        __dirname,
        'node_modules/@internationalized/date'
      ),
    };
    return config;
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

export default withSentryConfig(withNextIntl(nextConfig), {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI
});
