import { Suspense } from 'react';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';

import { Breadcrumbs } from '@/components/atoms';
import { ProductListingSkeleton } from '@/components/organisms/ProductListingSkeleton/ProductListingSkeleton';
import { AlgoliaProductsListing } from '@/components/sections/ProductListing/AlgoliaProductsListing';
import { ProductListing } from '@/components/sections/ProductListing/ProductListing';
import { listProducts } from '@/lib/data/products';
import { getRegion, listRegions } from '@/lib/data/regions';
import { getCountryCode } from '@/lib/helpers/country-code';
import { toHreflang } from '@/lib/helpers/hreflang';
import isBot from '@/lib/helpers/isBot';

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  let languages: Record<string, string> = {};
  try {
    const regions = await listRegions();
    const locales = Array.from(
      new Set((regions || []).flatMap(r => r.countries?.map(c => c.iso_2) || []))
    ) as string[];
    languages = locales.reduce<Record<string, string>>((acc, code) => {
      acc[toHreflang(code)] = `${baseUrl}/${code}/categories`;
      return acc;
    }, {});
  } catch {
    languages = { [toHreflang(locale)]: `${baseUrl}/${locale}/categories` };
  }

  const title = 'All Products';
  const description = `Browse all products on ${process.env.NEXT_PUBLIC_SITE_NAME || 'our store'}`;
  const canonical = `${baseUrl}/${locale}/categories`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ...languages, 'x-default': `${baseUrl}/categories` }
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} | ${process.env.NEXT_PUBLIC_SITE_NAME || 'Storefront'}`,
      description,
      url: canonical,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Storefront',
      type: 'website'
    }
  };
}

const ALGOLIA_ID = process.env.NEXT_PUBLIC_ALGOLIA_ID;
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

async function AllCategories({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const ua = (await headers()).get('user-agent') || '';
  const bot = isBot(ua);

  const breadcrumbsItems = [
    {
      path: '/',
      label: 'All Products'
    }
  ];

  let countryCode: string;
  let currency_code: string;
  let itemList: Array<{ '@type': string; position: number; url: string; name: string }> = [];
  let baseUrl: string;

  try {
    countryCode = await getCountryCode(locale);
    currency_code = (await getRegion(countryCode))?.currency_code || 'usd';

    // Fetch a small cached list for ItemList JSON-LD
    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = headersList.get('x-forwarded-proto') || 'https';
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
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
    console.error('Categories data fetch failed:', error);
    throw error;
  }

  return (
    <main id="main-content" className="container">
      <Script
        id="ld-breadcrumbs-categories"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'All Products',
                item: `${baseUrl}/${locale}/categories`
              }
            ]
          })
        }}
      />
      <Script
        id="ld-itemlist-categories"
        type="application/ld+json"
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

      <h1 className="heading-xl uppercase">All Products</h1>

      <Suspense
        fallback={
          <div data-testid="all-categories-page-loading">
            <ProductListingSkeleton />
          </div>
        }
      >
        {bot || !ALGOLIA_ID || !ALGOLIA_SEARCH_KEY ? (
          <ProductListing
            showSidebar
            locale={locale}
            searchParams={resolvedSearchParams}
          />
        ) : (
          <AlgoliaProductsListing
            locale={locale}
            countryCode={countryCode}
            currency_code={currency_code}
          />
        )}
      </Suspense>
    </main>
  );
}

export default AllCategories;
