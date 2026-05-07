import type { CSSProperties } from 'react';

import type { Metadata } from 'next';
import { Funnel_Display } from 'next/font/google';

import './globals.css';

import { Toaster } from '@medusajs/ui';

import { CookieBanner } from '@/components/cmp';
import { retrieveCart } from '@/lib/data/cart';
import { resolveStorefrontBaseUrl, validateStorefrontEnv } from '@/lib/env';
import { resolveMarketConfig } from '@/lib/portal.server';

import { Providers } from './providers';

const VALID_THEMES = ['bonbeauty'] as const;

validateStorefrontEnv();

const funnelDisplay = Funnel_Display({
  variable: '--font-funnel-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600']
});

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

  return {
    title: {
      template: titleTemplate,
      default: titleTemplate.replace('%s', siteName)
    },
    description:
      process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Mercur B2C Demo - Marketplace Storefront',
    metadataBase,
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
  // KNOWN LIMITATION: Root layout sits outside the [locale] segment so
  // params.locale is unavailable here. The static default is corrected
  // client-side by <HtmlLangSetter /> (uses next-intl useLocale()).
  // Crawlers that execute JS will see the correct lang; those that don't
  // will see 'pl'. A future middleware-based approach could inject a header.
  const htmlLang = 'pl';

  return (
    <html
      lang={htmlLang}
      className=""
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
        className={`${funnelDisplay.className} relative bg-primary text-secondary antialiased`}
        suppressHydrationWarning
      >
        {showFallbackBanner && (
          <div className="bg-yellow-100 px-4 py-2 text-sm text-yellow-900">
            Korzystasz z fallback MarketConfig. Payload API jest niedostepne.
          </div>
        )}
        <Providers cart={cart}>{children}</Providers>
        <Toaster position="top-right" />
        {/* ePrivacy CMP banner — Story v160-cleanup-34 (AC2, TF-80) */}
        <CookieBanner />
      </body>
    </html>
  );
}
