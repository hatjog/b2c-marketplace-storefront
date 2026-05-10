/**
 * Categories (All Products) page — v1.7.0 Story 2.2 update.
 *
 * Changes:
 *   - Hardcoded "All Products" replaced with i18n keys (category.page_title)
 *   - Breadcrumbs label localized
 *   - Loading skeleton wrapper gets data-testid for routing-load detection
 *   - WCAG: h1 text-primary, Suspense loading wraps Skeleton with aria-busy
 */
import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Script from 'next/script';

import {
  Breadcrumbs,
  StorefrontI18nLongContentProbe,
  StorefrontRouteStateSignal
} from '@/components/atoms';
import { ProductListingSkeleton } from '@/components/organisms/ProductListingSkeleton/ProductListingSkeleton';
import { ProductListing } from '@/components/sections/ProductListing/ProductListing';
import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { listProducts } from '@/lib/data/products';
import { getCountryCode } from '@/lib/helpers/country-code';
import { toHreflang } from '@/lib/helpers/hreflang';

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('category');
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  const languages = SUPPORTED_LOCALES.reduce<Record<string, string>>((acc, code) => {
    acc[toHreflang(code)] = `${baseUrl}/${code}/categories`;
    return acc;
  }, {});

  const title = t('page_title');
  const description = t('page_description');
  const canonical = `${baseUrl}/${locale}/categories`;
  const ogImage = `${baseUrl}/B2C_Storefront_Open_Graph.png`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ...languages, 'x-default': `${baseUrl}/pl/categories` }
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} | ${process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty'}`,
      description,
      url: canonical,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty'}`,
      description,
      images: [ogImage]
    }
  };
}

async function AllCategories({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const t = await getTranslations('category');
  const tAccessibility = await getTranslations('accessibility');

  const breadcrumbsItems = [
    {
      path: '/categories',
      label: t('page_title')
    }
  ];

  let itemList: Array<{ '@type': string; position: number; url: string; name: string }> = [];
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  try {
    const countryCode = await getCountryCode(locale);

    const {
      response: { products: jsonLdProducts }
    } = await listProducts({
      countryCode,
      queryParams: { limit: 8, order: 'created_at', fields: 'id,title,handle' }
    });

    itemList = jsonLdProducts.slice(0, 8).map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${baseUrl}/${locale}/products/${p.handle}`,
      name: p.title
    }));
  } catch (error) {
    console.warn('Categories structured data fetch failed:', error);
  }

  return (
    <main
      id="main-content"
      className="container"
    >
      <StorefrontRouteStateSignal
        route="categories"
        surface="category"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="category-listing"
      />
      <Script
        id="ld-breadcrumbs-categories"
        type="application/ld+json"
        // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: t('page_title'),
                item: `${baseUrl}/${locale}/categories`
              }
            ]
          })
        }}
      />
      <Script
        id="ld-itemlist-categories"
        type="application/ld+json"
        // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: itemList
          })
        }}
      />
      <div className="mb-2 hidden md:block">
        <Breadcrumbs items={breadcrumbsItems} />
      </div>

      {/* h1: uses text-primary token (heading-xl) per bb-surfaces typography */}
      <h1 className="heading-xl uppercase text-primary">{t('page_title')}</h1>

      {/* Suspense: routing-load fallback distinguishes initial page hydration
          from submit-load (filter/sort change). aria-label uses i18n. */}
      <Suspense
        fallback={
          <div
            data-testid="all-categories-page-loading"
            aria-label={tAccessibility('loading')}
          >
            <ProductListingSkeleton />
          </div>
        }
      >
        <ProductListing
          showSidebar
          locale={locale}
          searchParams={resolvedSearchParams}
        />
      </Suspense>
    </main>
  );
}

export default AllCategories;
