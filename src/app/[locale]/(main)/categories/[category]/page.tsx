import { Suspense } from 'react';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Script from 'next/script';

import { Breadcrumbs } from '@/components/atoms';
import { SanitizedHTML } from '@/components/molecules';
import { ProductListingSkeleton } from '@/components/organisms/ProductListingSkeleton/ProductListingSkeleton';
import { ProductListing } from '@/components/sections/ProductListing/ProductListing';
import { getCategoryByHandle } from '@/lib/data/categories';
import { listProducts } from '@/lib/data/products';
import { listRegions } from '@/lib/data/regions';
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

  let languages: Record<string, string> = {};
  try {
    const regions = await listRegions();
    const locales = Array.from(
      new Set((regions || []).flatMap(r => r.countries?.map(c => c.iso_2) || []))
    ) as string[];
    languages = locales.reduce<Record<string, string>>((acc, code) => {
      acc[toHreflang(code)] = `${baseUrl}/${code}/categories/${categoryHandle}`;
      return acc;
    }, {});
  } catch {
    languages = {
      [toHreflang(locale)]: `${baseUrl}/${locale}/categories/${categoryHandle}`
    };
  }

  const seo = resolveGpSeoMetadata(
    cat.metadata as Record<string, unknown> | null | undefined
  );
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BonBeauty';
  const title = seo.meta_title ?? cat.name;
  const description =
    seo.meta_description ?? `${cat.name} — zabiegi i vouchery na ${siteName}.`;
  const ogImage = seo.og_image_url ?? `${baseUrl}/images/placeholder.svg`;
  const canonical = `${baseUrl}/${locale}/categories/${categoryHandle}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ...languages,
        'x-default': `${baseUrl}/categories/${categoryHandle}`
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
    <main id="main-content" className="container">
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

      <h1 className="heading-xl uppercase">{category.name}</h1>
      <SanitizedHTML html={category.description} className="mt-4 mb-6 text-sm text-secondary" />

      <Suspense
        fallback={
          <div data-testid="category-page-loading">
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
