import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';

import { Breadcrumbs } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { getCollectionPhotoUrl } from '@/lib/collection-media';
import { listCollections } from '@/lib/data/collections';
import { listRegions } from '@/lib/data/regions';
import { toHreflang } from '@/lib/helpers/hreflang';

export const revalidate = 60;

function getCollectionsCopy(locale: string) {
  if (locale === 'pl') {
    return {
      title: 'Kolekcje',
      description: `Poznaj starannie wybrane kolekcje w ${process.env.NEXT_PUBLIC_SITE_NAME || 'naszym sklepie'}`,
      intro: 'Przeglądaj starannie dobrane kolekcje przygotowane dla aktywnego marketu.',
      emptyState: 'Dla tego marketu nie ma jeszcze dostępnych kolekcji.'
    };
  }

  return {
    title: 'Collections',
    description: `Browse curated collections on ${process.env.NEXT_PUBLIC_SITE_NAME || 'our store'}`,
    intro: 'Explore curated product collections prepared for the active market.',
    emptyState: 'No collections are available for this market yet.'
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = getCollectionsCopy(locale);
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  let languages: Record<string, string> = {};
  try {
    const regions = await listRegions();
    const locales = Array.from(
      new Set((regions || []).flatMap(region => region.countries?.map(country => country.iso_2) || []))
    ) as string[];
    languages = locales.reduce<Record<string, string>>((acc, code) => {
      acc[toHreflang(code)] = `${baseUrl}/${code}/collections`;
      return acc;
    }, {});
  } catch {
    languages = { [toHreflang(locale)]: `${baseUrl}/${locale}/collections` };
  }

  const { title, description } = copy;
  const canonical = `${baseUrl}/${locale}/collections`;
  const ogImage = `${baseUrl}/B2C_Storefront_Open_Graph.png`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ...languages, 'x-default': `${baseUrl}/collections` }
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} | ${process.env.NEXT_PUBLIC_SITE_NAME || 'Storefront'}`,
      description,
      url: canonical,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Storefront',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${process.env.NEXT_PUBLIC_SITE_NAME || 'Storefront'}`,
      description,
      images: [ogImage]
    }
  };
}

const CollectionsPage = async ({
  params
}: {
  params: Promise<{ locale: string }>;
}) => {
  const { locale } = await params;
  const copy = getCollectionsCopy(locale);
  const { collections } = await listCollections();

  const breadcrumbsItems = [
    {
      path: '/',
      label: copy.title
    }
  ];

  return (
    <main id="main-content" className="container">
      <div className="mb-2 hidden md:block">
        <Breadcrumbs items={breadcrumbsItems} />
      </div>

      <div className="max-w-3xl">
        <h1 className="heading-xl uppercase">{copy.title}</h1>
        <p className="mt-4 text-sm text-secondary">{copy.intro}</p>
      </div>

      {collections.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map(collection => {
            const imageSrc = getCollectionPhotoUrl(collection) || '/images/placeholder.svg';

            return (
              <LocalizedClientLink
                key={collection.id}
                href={`/collections/${collection.handle}`}
                className="group relative flex min-h-[320px] overflow-hidden rounded-[28px] border border-[rgba(144,112,50,0.14)] bg-[rgba(255,255,255,0.75)] shadow-[0_16px_40px_rgba(90,67,28,0.08)] transition-transform duration-300 hover:-translate-y-1"
                data-testid="collection-item"
              >
                <div className="absolute inset-0">
                  <Image
                    loading="lazy"
                    src={imageSrc}
                    alt={`collection - ${collection.title}`}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                </div>

                <div className="relative mt-auto flex w-full items-end justify-between gap-3 p-5 text-white">
                  <div>
                    <h2 className="heading-md max-w-[16ch]">{collection.title}</h2>
                    {collection.metadata?.subtitle ? (
                      <p className="mt-2 text-sm text-white/80">{String(collection.metadata.subtitle)}</p>
                    ) : null}
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/10 text-xl backdrop-blur transition-colors duration-300 group-hover:bg-white group-hover:text-primary">
                    +
                  </span>
                </div>
              </LocalizedClientLink>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-[28px] border border-[rgba(144,112,50,0.14)] bg-[rgba(255,255,255,0.75)] p-8 text-sm text-secondary shadow-[0_16px_40px_rgba(90,67,28,0.08)]">
          {copy.emptyState}
        </div>
      )}
    </main>
  );
};

export default CollectionsPage;