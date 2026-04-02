import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import enMessages from './messages/en.json';
import plMessages from './messages/pl.json';
import { loadSlugRedirectsForNext } from './scripts/slug-redirects';
import { generateLocaleRewrites } from './src/i18n/locale-rewrite-rules';

const distDir = process.env.GP_STOREFRONT_DIST_DIR || '.next';

const nextConfig: NextConfig = {
  distDir,
  output: "standalone",
  trailingSlash: false,
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  images: {
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
      en: enMessages.routes
    });
  }
};

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

export default withSentryConfig(withNextIntl(nextConfig), {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI
});
