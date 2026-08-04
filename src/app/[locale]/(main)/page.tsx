// @trust-invariant-scope: v180
// W1-01 Home v3 — Story 3.0 Sprint 1 thin slice gate.
// Trust Invariant #1: <VerifiedMark present via TrustStripBlock.
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import Script from 'next/script';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { HomepageRenderer } from '@/components/blocks/HomepageRenderer';
import { TrustStripBlock } from '@/components/blocks/TrustStripBlock';
import { isSupportedLocale } from '@/i18n/routing';
import { toHreflang } from '@/lib/helpers/hreflang';
import { resolveMarketLocales } from '@/lib/market-locales';
import { resolveMarketConfig } from '@/lib/portal.server';
import { resolveRuntimeHomepageSeo } from '@/lib/runtime-market-config';
import { buildLocaleAlternates } from '@/lib/seo/hreflang';

export const revalidate = 300;

function isSectionObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildHomeV3FallbackSections(tHome: Awaited<ReturnType<typeof getTranslations>>) {
  return [
    {
      id: 'home-v3-hero',
      blockType: 'hero',
      enabled: true,
      heading: tHome('heading'),
      paragraph: tHome('paragraph'),
      buttons: [],
    },
    {
      id: 'home-v3-categories',
      blockType: 'categories_grid',
      enabled: true,
      limit: 8,
      hide_empty: false,
    },
    {
      id: 'home-v3-popular',
      blockType: 'products_carousel',
      enabled: true,
      sort: 'newest',
      limit: 8,
      show_price: true,
      show_vendor: true,
    },
    {
      id: 'home-v3-editorial',
      blockType: 'editorial_dark_band',
      enabled: true,
    },
    {
      id: 'home-v3-gift',
      blockType: 'gift_cta_card',
      enabled: true,
    },
    {
      id: 'home-v3-journal',
      blockType: 'journal_teaser',
      enabled: true,
    },
  ];
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'homepage' });

  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  // Build alternates from the market-aware resolver (ADR-046: URL = language, not
  // country; Story 1.1 v1.14.0 AC1 — market-aware locale resolver, not SUPPORTED_LOCALES).
  const alternates = await buildLocaleAlternates(locale, loc => `/${loc}`, baseUrl);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty';

  // QD-01: market-authored, locale-resolved SEO copy wins; `messages` stays the
  // generic default for markets that do not author a `seo:` block. Before this
  // package the YAML block had no reader at all.
  const marketLocales = await resolveMarketLocales();
  const routeLocale = isSupportedLocale(locale) ? locale : marketLocales.defaultLocale;
  const marketSeo = await resolveRuntimeHomepageSeo(
    process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '',
    routeLocale,
    marketLocales
  );

  const title = marketSeo.meta_title ?? t('meta_title');
  const description = marketSeo.meta_description ?? t('meta_description');
  const ogImage = '/B2C_Storefront_Open_Graph.png';
  const canonical = alternates.canonical;

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-video-preview': -1,
        'max-snippet': -1
      }
    },
    alternates: {
      canonical,
      languages: alternates.languages
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: 'website',
      images: [
        {
          url: ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`,
          width: 1200,
          height: 630,
          alt: siteName
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`]
    }
  };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tHome = await getTranslations({ locale, namespace: 'home_v3.hero' });
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  // QD-01: the route locale is handed to the market-copy resolver explicitly.
  // A locale outside the market's set never reaches here (middleware redirects
  // per ADR-154), so falling back to the market default is a type guard, not policy.
  const marketLocales = await resolveMarketLocales();
  const routeLocale = isSupportedLocale(locale) ? locale : marketLocales.defaultLocale;
  const { marketConfig } = await resolveMarketConfig(marketId, routeLocale);
  const homepageSectionsFromConfig =
    Array.isArray(marketConfig.homepage_sections) && marketConfig.homepage_sections.length > 0
      ? marketConfig.homepage_sections
      : null;
  const homepageSections = homepageSectionsFromConfig ?? buildHomeV3FallbackSections(tHome);
  const trustStripSection = homepageSections.find(
    (section) =>
      isSectionObject(section) &&
      section.blockType === 'trust_strip' &&
      section.enabled === true
  ) as
    | {
        verifiedLabel?: string;
        trustPoints?: Parameters<typeof TrustStripBlock>[0]['trustPoints'];
      }
    | undefined;
  const homepageSectionsWithoutTrustStrip = homepageSections.filter(
    (section) => !(isSectionObject(section) && section.blockType === 'trust_strip')
  );

  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty';

  return (
    <main
      id="main-content"
      className="bb-page-shell row-start-2 text-primary"
    >
      <StorefrontRouteStateSignal
        route="home"
        surface="home"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="home"
      />
      {/* Organization JSON-LD */}
      <Script
        id="ld-org"
        type="application/ld+json"
        // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: siteName,
            url: `${baseUrl}/${locale}`,
            logo: `${baseUrl}/favicon.ico`
          })
        }}
      />
      {/* WebSite JSON-LD */}
      <Script
        id="ld-website"
        type="application/ld+json"
        // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: siteName,
            url: `${baseUrl}/${locale}`,
            inLanguage: toHreflang(locale)
          })
        }}
      />
      <HomepageRenderer
        sections={homepageSectionsWithoutTrustStrip}
        locale={locale}
      />
      {/* W1-01 home v3 trust strip — always rendered exactly once at bottom surface. */}
      <TrustStripBlock
        locale={locale}
        verifiedLabel={trustStripSection?.verifiedLabel ?? tHome('trust_verified_label')}
        trustPoints={trustStripSection?.trustPoints}
      />
    </main>
  );
}
