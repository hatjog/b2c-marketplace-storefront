import type { Metadata } from 'next';
import { Funnel_Display } from 'next/font/google';
import type { CSSProperties } from 'react';

import './globals.css';

import { Toaster } from '@medusajs/ui';
import Head from 'next/head';

import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';
import { retrieveCart } from '@/lib/data/cart';
import { resolveMarketConfig } from '@/lib/portal';

import { Providers } from './providers';

const funnelDisplay = Funnel_Display({
  variable: '--font-funnel-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600']
});

export async function generateMetadata(): Promise<Metadata> {
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);
  const siteName =
    marketConfig.name || process.env.NEXT_PUBLIC_SITE_NAME || 'Mercur B2C Demo - Marketplace Storefront';
  const titlePattern = marketConfig.seo_defaults?.title_pattern;
  const titleTemplate =
    typeof titlePattern === 'string' && titlePattern.includes('%s')
      ? titlePattern
      : `%s | ${siteName}`;

  return {
    title: {
      template: titleTemplate,
      default: titleTemplate.replace('%s', siteName)
    },
    description:
      process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Mercur B2C Demo - Marketplace Storefront',
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
    alternates: {
      languages: {
        'x-default': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
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
  const { marketConfig } = await resolveMarketConfig(marketId);

  const ALGOLIA_APP = process.env.NEXT_PUBLIC_ALGOLIA_ID;
  const htmlStyle: CSSProperties | undefined = marketConfig.primary_color
    ? ({ '--color-primary': marketConfig.primary_color } as CSSProperties)
    : undefined;
  const themeStylesheet = marketConfig.theme ? `/themes/${marketConfig.theme}.css` : null;
  // default lang updated by HtmlLangSetter
  const htmlLang = 'en';

  return (
    <html
      lang={htmlLang}
      className=""
      style={htmlStyle}
    >
      <Head>
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
      </Head>
      <body className={`${funnelDisplay.className} relative bg-primary text-secondary antialiased`}>
        <HtmlLangSetter />
        <Providers cart={cart}>{children}</Providers>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
