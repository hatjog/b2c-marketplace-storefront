import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import deMessages from './messages/de.json';
import enMessages from './messages/en.json';
import plMessages from './messages/pl.json';
import uaMessages from './messages/ua.json';
import { loadSlugRedirectsForNext } from './scripts/slug-redirects';
import { generateLocaleRewrites } from './src/i18n/locale-rewrite-rules';
import { CSP_DIRECTIVES, resolveCspHeaderName } from './src/lib/security/csp';

const distDir = process.env.GP_STOREFRONT_DIST_DIR || '.next';

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
    // NOTE (tighten-pass): the trailing `https://**` wildcard predates this
    // story and is NOT relied upon by category images; ADR-159 flags it for
    // narrowing before production promotion.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'medusa-public-images.s3.eu-west-1.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'mercur-connect.s3.eu-central-1.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'api.mercurjs.com'
      },
      {
        protocol: 'http',
        hostname: 'localhost'
      },
      {
        protocol: 'https',
        hostname: 'api-sandbox.mercurjs.com',
        pathname: '/static/**'
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com'
      },
      {
        protocol: 'https',
        hostname: 's3.eu-central-1.amazonaws.com'
      },
      {
        protocol: "https",
        hostname: "mercur-testing.up.railway.app",
      },
      {
        protocol: 'https',
        hostname: '**'
      }
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
        source: '/:locale/gp-dashboard/:path*',
        destination: 'http://localhost:3000/gp-dashboard/:path*',
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
