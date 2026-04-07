import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';

import { HomepageRenderer } from '@/components/blocks/HomepageRenderer';
import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { toHreflang } from '@/lib/helpers/hreflang';
import { resolveMarketConfig } from '@/lib/portal.server';

export const revalidate = 300;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('homepage');

  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  // Build alternates based on supported languages (ADR-046: URL = language, not country)
  const languages = SUPPORTED_LOCALES.reduce<Record<string, string>>((acc, lang) => {
    acc[toHreflang(lang)] = `${baseUrl}/${lang}`;
    return acc;
  }, {});

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty';
  const title = t('meta_title');
  const description = t('meta_description');
  const ogImage = '/B2C_Storefront_Open_Graph.png';
  const canonical = `${baseUrl}/${locale}`;

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
      languages: {
        ...languages,
        'x-default': baseUrl
      }
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
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);
  const homepageSections =
    Array.isArray(marketConfig.homepage_sections) && marketConfig.homepage_sections.length > 0
      ? marketConfig.homepage_sections
      : null;

  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty';

  return (
    <main id="main-content" className="bb-page-shell row-start-2 text-primary">
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
        sections={homepageSections}
        locale={locale}
      />
    </main>
  );
}
