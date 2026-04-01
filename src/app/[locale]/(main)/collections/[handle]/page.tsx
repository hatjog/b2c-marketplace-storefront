import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { Suspense } from 'react';

import NotFound from '@/app/not-found';
import { Breadcrumbs } from '@/components/atoms';
import { SanitizedHTML } from '@/components/molecules';
import { ProductListingSkeleton } from '@/components/organisms/ProductListingSkeleton/ProductListingSkeleton';
import { AlgoliaProductsListing } from '@/components/sections/ProductListing/AlgoliaProductsListing';
import { ProductListing } from '@/components/sections/ProductListing/ProductListing';
import { getCollectionPhotoUrl } from '@/lib/collection-media';
import { getCollectionByHandle } from '@/lib/data/collections';
import { getRegion } from '@/lib/data/regions';
import { getCountryCode } from '@/lib/helpers/country-code';
import isBot from '@/lib/helpers/isBot';
import { generateCollectionMetadata } from '@/lib/helpers/seo';

const ALGOLIA_ID = process.env.NEXT_PUBLIC_ALGOLIA_ID;
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ handle: string; locale: string }>;
}): Promise<Metadata> {
  const { handle, locale } = await params;
  const collection = await getCollectionByHandle(handle);

  if (!collection) {
    return {};
  }

  const baseUrl = await getBaseUrl();
  const collectionMeta = generateCollectionMetadata(collection, baseUrl, locale);

  // OG image: prefer collection photo over SEO placeholder
  const photoUrl = getCollectionPhotoUrl(collection);
  if (photoUrl) {
    const photoAbsolute = photoUrl.startsWith('http') ? photoUrl : `${baseUrl}${photoUrl}`;
    if (collectionMeta.openGraph && Array.isArray(collectionMeta.openGraph.images)) {
      collectionMeta.openGraph.images = [{ url: photoAbsolute, alt: collection.title }];
    }
    if (collectionMeta.twitter && Array.isArray(collectionMeta.twitter.images)) {
      collectionMeta.twitter.images = [photoAbsolute];
    }
  }

  return collectionMeta;
}

const SingleCollectionsPage = async ({
  params,
  searchParams
}: {
  params: Promise<{ handle: string; locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { handle, locale } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? '';
  const bot = isBot(userAgent);
  const collection = await getCollectionByHandle(handle);

  if (!collection) return <NotFound />;

  const countryCode = await getCountryCode(locale);
  const currency_code = (await getRegion(countryCode))?.currency_code || 'usd';
  const collectionPhotoUrl = getCollectionPhotoUrl(collection);

  const breadcrumbsItems = [
    {
      path: collection.handle,
      label: collection.title
    }
  ];

  return (
    <main id="main-content" className="container">
      <div className="mb-2 hidden md:block">
        <Breadcrumbs items={breadcrumbsItems} />
      </div>

      {collectionPhotoUrl ? (
        <div
          className="relative mb-6 aspect-[21/9] overflow-hidden rounded-sm bg-quaternary"
          data-testid="collection-cover"
        >
          <Image
            src={collectionPhotoUrl}
            alt={`${collection.title} cover image`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <h1 className="heading-xl uppercase">{collection.title}</h1>
      <SanitizedHTML html={collection.description ?? null} className="mt-4 mb-6 text-sm text-secondary" />

      <Suspense
        fallback={
          <div data-testid="collection-page-loading">
            <ProductListingSkeleton />
          </div>
        }
      >
        {bot || !ALGOLIA_ID || !ALGOLIA_SEARCH_KEY ? (
          <ProductListing
            collection_id={collection.id}
            showSidebar
            locale={locale}
            searchParams={resolvedSearchParams}
          />
        ) : (
          <AlgoliaProductsListing
            collection_id={collection.id}
            locale={locale}
            countryCode={countryCode}
            currency_code={currency_code}
          />
        )}
      </Suspense>
    </main>
  );
};

export default SingleCollectionsPage;
