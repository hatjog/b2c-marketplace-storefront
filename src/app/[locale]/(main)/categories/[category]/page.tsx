import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Script from 'next/script';

import {
  Breadcrumbs,
  StorefrontI18nLongContentProbe,
  StorefrontRouteStateSignal
} from '@/components/atoms';
import { SanitizedHTML } from '@/components/molecules';
import { ProductListingSkeleton } from '@/components/organisms/ProductListingSkeleton/ProductListingSkeleton';
import { ProductListing } from '@/components/sections/ProductListing/ProductListing';
import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { getCategoryByHandle } from '@/lib/data/categories';
import { listProducts } from '@/lib/data/products';
import { isMultiVendorEnabledRuntime } from '@/lib/flags/multiVendorPricing';
import { getCountryCode } from '@/lib/helpers/country-code';
import { toHreflang } from '@/lib/helpers/hreflang';
import { resolveGpSeoMetadata } from '@/lib/helpers/seo';

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ category: string; locale: string }>;
}): Promise<Metadata> {
  const { category: categoryHandle, locale } = await params;
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  const cat = await getCategoryByHandle(categoryHandle);
  if (!cat) {
    return {};
  }

  const languages = SUPPORTED_LOCALES.reduce<Record<string, string>>((acc, code) => {
    acc[toHreflang(code)] = `${baseUrl}/${code}/categories/${categoryHandle}`;
    return acc;
  }, {});

  const seo = resolveGpSeoMetadata(cat.metadata as Record<string, unknown> | null | undefined);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty';
  const title = seo.meta_title ?? cat.name;
  // v1.7.0 Story 2.2 re-review fix (HIGH H1'): description fallback resolved
  // through i18n instead of the previous hardcoded PL literal that bled into
  // EN/UA/DE SERPs and og:description channels.
  const tMeta = await getTranslations('category');
  const description =
    seo.meta_description ?? tMeta('fallback_description', { categoryName: cat.name, siteName });
  const ogImage = seo.og_image_url ?? `${baseUrl}/B2C_Storefront_Open_Graph.png`;
  const canonical = `${baseUrl}/${locale}/categories/${categoryHandle}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ...languages,
        'x-default': `${baseUrl}/pl/categories/${categoryHandle}`
      }
    },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage]
    }
  };
}

async function Category({
  params,
  searchParams
}: {
  params: Promise<{
    category: string;
    locale: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category: categoryHandle, locale } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  // v1.7.0 Story 2.2 review fix (HIGH H1): Suspense fallback aria-label must
  // come from i18n — not a hardcoded PL string — so EN/UA/DE SR announcements
  // match the visible page locale (AC3).
  const tAccessibility = await getTranslations('accessibility');

  // Story v160-cleanup-13c — warm runtime feature-flag cache before any
  // downstream sync `isMultiVendorEnabled()` calls inside ProductCard etc.
  // If backend reports 'off', the sync helpers will return false even when
  // the build-baked NEXT_PUBLIC_* env says true.
  await isMultiVendorEnabledRuntime();

  const category = await getCategoryByHandle(categoryHandle);

  if (!category) {
    return notFound();
  }
  const countryCode = await getCountryCode(locale);

  // Collect category IDs: parent + all children (products live in leaf categories)
  const childIds = (category.category_children || []).map((c: { id: string }) => c.id);
  const categoryIds = childIds.length > 0 ? [category.id, ...childIds] : category.id;

  const breadcrumbsItems = [
    {
      path: categoryHandle,
      label: category.name
    }
  ];

  // Small cached list for JSON-LD itemList
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
  const {
    response: { products: jsonLdProducts }
  } = await listProducts({
    countryCode,
    queryParams: { limit: 8, order: 'created_at', fields: 'id,title,handle' },
    category_id: categoryIds
  });

  const itemList = jsonLdProducts.slice(0, 8).map((p, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    url: `${baseUrl}/${locale}/products/${p.handle}`,
    name: p.title
  }));

  return (
    <main
      id="main-content"
      className="container"
    >
      <StorefrontRouteStateSignal
        route="category-detail"
        surface="category"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="category-detail"
      />
      <Script
        id="ld-breadcrumbs-category"
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
                name: category.name,
                item: `${baseUrl}/${locale}/categories/${categoryHandle}`
              }
            ]
          })
        }}
      />
      <Script
        id="ld-itemlist-category"
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

      {/* h1: uses text-primary token per bb-surfaces typography */}
      <h1 className="heading-xl uppercase text-primary">{category.name}</h1>
      <SanitizedHTML
        html={category.description}
        className="mb-6 mt-4 text-sm text-secondary"
      />

      {/* Suspense: routing-load fallback (initial page hydration) — aria-label distinguishes
          from submit-load (filter/sort change). Loading skeleton is BonBeauty-aligned. */}
      <Suspense
        fallback={
          <div
            data-testid="category-page-loading"
            aria-label={tAccessibility('loading')}
          >
            <ProductListingSkeleton />
          </div>
        }
      >
        <ProductListing
          category_id={categoryIds}
          showSidebar
          locale={locale}
          searchParams={resolvedSearchParams}
        />
      </Suspense>
    </main>
  );
}

export default Category;
