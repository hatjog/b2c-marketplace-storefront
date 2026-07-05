// @chrome-manifest: W6-04 (renders <CookieBanner> — cookie-banner chrome component)
import type { CSSProperties } from 'react';

import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { getMessages } from 'next-intl/server';
import localFont from 'next/font/local';
import { headers } from 'next/headers';

import './globals.css';

import { Toaster } from '@medusajs/ui';

import { CookieBanner } from '@/components/cmp';
import { retrieveCart } from '@/lib/data/cart';
import { resolveStorefrontBaseUrl, validateStorefrontEnv } from '@/lib/env';
import { toHreflang } from '@/lib/helpers/hreflang';
import { getMarketFaviconUrl } from '@/lib/portal';
import { resolveMarketConfig } from '@/lib/portal.server';

import { Providers } from './providers';

const VALID_THEMES = ['bonbeauty'] as const;

/**
 * BonBeauty brand face — Funnel Display variable font (weight axis 300–800).
 * Self-hosted via next/font/local (no runtime Google request → GDPR-safe,
 * reproducible build). Exposes `--font-funnel-sans`, consumed by the
 * `--font-family-sans` / `--font-display` token chain (src/styles/tokens/typography.css).
 * Storefront-only per ARCH-007; admin/vendor/operator surfaces use --font-ops (Inter).
 */
const funnelDisplay = localFont({
  src: './fonts/FunnelDisplay-VariableFont_wght.ttf',
  variable: '--font-funnel-sans',
  weight: '300 800',
  style: 'normal',
  display: 'swap'
});

validateStorefrontEnv();

export async function generateMetadata(): Promise<Metadata> {
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);
  const siteName =
    marketConfig.name ||
    process.env.NEXT_PUBLIC_SITE_NAME ||
    'Mercur B2C Demo - Marketplace Storefront';
  const titlePattern = marketConfig.seo_defaults?.title_pattern;
  const titleTemplate =
    typeof titlePattern === 'string' && titlePattern.includes('%s')
      ? titlePattern
      : `%s | ${siteName}`;

  const baseUrl = resolveStorefrontBaseUrl();
  const metadataBase = new URL(baseUrl);

  // Per-market favicon: resolved from market config (storefront.favicon),
  // served via the runtime-market-assets route. When absent, omit `icons`
  // so Next falls back to the app/favicon.ico file convention.
  const faviconUrl = getMarketFaviconUrl(marketConfig);

  return {
    title: {
      template: titleTemplate,
      default: titleTemplate.replace('%s', siteName)
    },
    description:
      process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Mercur B2C Demo - Marketplace Storefront',
    metadataBase,
    ...(faviconUrl
      ? {
          icons: {
            icon: faviconUrl,
            shortcut: faviconUrl
          }
        }
      : {}),
    alternates: {
      languages: {
        'x-default': baseUrl
      }
    }
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cart = await retrieveCart();
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig, usedFallback } = await resolveMarketConfig(marketId);
  const showFallbackBanner = usedFallback && process.env.NODE_ENV === 'development';

  const ALGOLIA_APP = process.env.NEXT_PUBLIC_ALGOLIA_ID;
  const htmlStyle: CSSProperties | undefined = marketConfig.primary_color
    ? ({ '--color-primary': marketConfig.primary_color } as CSSProperties)
    : undefined;
  const themeStylesheet =
    marketConfig.theme && (VALID_THEMES as readonly string[]).includes(marketConfig.theme)
      ? `/themes/${marketConfig.theme}.css`
      : null;
  const headersList = await headers();
  const gpLocaleHeader = headersList.get('x-gp-locale');
  // R1-LOW fix: when middleware did not set `x-gp-locale` (routes that bypass
  // the middleware matcher), do NOT hardcode `pl` — derive the locale from the
  // URL segment via next-intl's request-scoped `getLocale()` so `<html lang>`
  // stays correct on /en|/ua|/de. `getLocale()` itself falls back to the
  // default locale only when the segment is missing/unsupported.
  if (!gpLocaleHeader && process.env.NODE_ENV !== 'production') {
    // R-5 defensive: middleware powinno ustawić x-gp-locale dla każdej non-redirect
    // gałęzi; brak nagłówka → deryfujemy locale z URL segmentu (getLocale),
    // sygnalizujemy w dev/preview aby wychwycić ewentualny matcher gap.
    console.warn('[layout] missing x-gp-locale header — deriving lang from URL locale segment');
  }
  const resolvedLocale = gpLocaleHeader ?? (await getLocale());
  const htmlLang = toHreflang(resolvedLocale);
  const rootMessages = await getMessages({ locale: resolvedLocale });
  const tCommon = await getTranslations({ locale: resolvedLocale, namespace: 'common' });

  return (
    <html
      lang={htmlLang}
      className={funnelDisplay.variable}
      style={htmlStyle}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://fonts.gstatic.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://i.imgur.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://i.imgur.com"
        />
        {ALGOLIA_APP && (
          <>
            <link
              rel="preconnect"
              href="https://algolia.net"
              crossOrigin="anonymous"
            />
            <link
              rel="preconnect"
              href="https://algolianet.com"
              crossOrigin="anonymous"
            />
            <link
              rel="dns-prefetch"
              href="https://algolia.net"
            />
            <link
              rel="dns-prefetch"
              href="https://algolianet.com"
            />
          </>
        )}
        {/* Image origins for faster LCP */}
        <link
          rel="preconnect"
          href="https://medusa-public-images.s3.eu-west-1.amazonaws.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://medusa-public-images.s3.eu-west-1.amazonaws.com"
        />
        <link
          rel="preconnect"
          href="https://mercur-connect.s3.eu-central-1.amazonaws.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://mercur-connect.s3.eu-central-1.amazonaws.com"
        />
        <link
          rel="preconnect"
          href="https://s3.eu-central-1.amazonaws.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://s3.eu-central-1.amazonaws.com"
        />
        <link
          rel="preconnect"
          href="https://api.mercurjs.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://api.mercurjs.com"
        />
        {themeStylesheet && (
          <link
            rel="stylesheet"
            href={themeStylesheet}
          />
        )}
      </head>
      <body
        className="relative bg-primary text-secondary antialiased"
        suppressHydrationWarning
      >
        {showFallbackBanner && (
          <div className="bg-yellow-100 px-4 py-2 text-sm text-yellow-900">
            {tCommon('market_config_fallback')}
          </div>
        )}
        <Providers cart={cart}>{children}</Providers>
        <Toaster position="top-right" />
        {/* ePrivacy CMP banner — Story v160-cleanup-34 (AC2, TF-80) */}
        <NextIntlClientProvider
          locale={resolvedLocale}
          messages={rootMessages}
        >
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
