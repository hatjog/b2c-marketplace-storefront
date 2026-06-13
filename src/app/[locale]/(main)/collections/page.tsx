import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Image from 'next/image';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { listEditorialCollections } from '@/lib/data/editorial-collections';

export const revalidate = 60;

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

function buildAlternates(baseUrl: string, locale: string) {
  const languages = SUPPORTED_LOCALES.reduce<Record<string, string>>((acc, current) => {
    acc[current] = `${baseUrl}/${current}/collections`;
    return acc;
  }, {});

  return {
    canonical: `${baseUrl}/${locale}/collections`,
    languages: {
      ...languages,
      'x-default': `${baseUrl}/pl/collections`
    }
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('collections_editorial_v180.meta');
  const baseUrl = await getBaseUrl();

  return {
    title: t('title'),
    description: t('description'),
    metadataBase: new URL(baseUrl),
    alternates: buildAlternates(baseUrl, locale),
    robots: { index: true, follow: true },
    openGraph: {
      title: t('title'),
      description: t('description')
    }
  };
}

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, listing] = await Promise.all([
    getTranslations('collections_editorial_v180'),
    listEditorialCollections(locale)
  ]);
  const featured = listing.featured;

  return (
    <main
      id="main-content"
      className="bb-page-shell pb-16"
      data-testid="collections-index-page"
    >
      <div className="container space-y-8 py-4 md:space-y-10">
        <StorefrontRouteStateSignal
          route="collections"
          surface="listing"
        />
        <Breadcrumbs
          items={[
            { label: t('breadcrumbs.home'), href: `/${locale}/` },
            { label: t('breadcrumbs.collections'), href: `/${locale}/collections` }
          ]}
        />

        {featured ? (
          <section
            className="bb-skin-hero relative px-6 py-8 text-white md:px-8 md:py-10"
            data-testid="collections-index-hero"
          >
            {featured.imageUrl ? (
              <div className="absolute inset-0 opacity-35">
                <Image
                  src={featured.imageUrl}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-end">
              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/70">
                  {t('hero.eyebrow')}
                </p>
                <h1 className="heading-xl max-w-[14ch]">{t('hero.title')}</h1>
                <p className="text-white/82 max-w-2xl text-sm leading-7">{t('hero.body')}</p>
                <div className="flex flex-wrap gap-3">
                  <LocalizedClientLink
                    href={`/collections/${featured.handle}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-white px-5 py-2 text-sm font-medium text-primary"
                  >
                    {t('hero.cta')}
                  </LocalizedClientLink>
                  <span className="text-white/82 inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 py-2 text-sm">
                    {t('hero.noAlgorithm')}
                  </span>
                </div>
              </div>
              <article className="border-white/12 rounded-[var(--bb-radius-card)] border bg-white/10 p-5 backdrop-blur-sm">
                <p className="label-sm text-white/70">{t('featured.label')}</p>
                <h2 className="heading-md mt-3 text-white">{featured.title}</h2>
                <p className="text-white/82 mt-3 text-sm leading-7">{featured.excerpt}</p>
                <p className="mt-4 text-sm text-white/65">
                  {t('featured.itemCount', { count: featured.itemCount })}
                </p>
              </article>
            </div>
          </section>
        ) : null}

        <section
          className="grid gap-4 md:grid-cols-3"
          aria-label={t('buckets.aria')}
          data-testid="collections-index-featured-header"
        >
          {(['editorial', 'seasonal', 'recommended'] as const).map(bucket => (
            <article
              key={bucket}
              className="bb-skin-panel p-5"
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-secondary">
                {t(`buckets.${bucket}.eyebrow`)}
              </p>
              <h2 className="heading-sm mt-3 text-primary">{t(`buckets.${bucket}.title`)}</h2>
              <p className="mt-2 text-sm leading-7 text-secondary">{t(`buckets.${bucket}.body`)}</p>
            </article>
          ))}
        </section>

        <section
          className="space-y-6"
          data-testid="collections-index-grid-header"
        >
          <div className="max-w-3xl">
            <h2 className="heading-lg text-primary">{t('grid.title')}</h2>
            <p className="mt-3 text-sm leading-7 text-secondary">{t('grid.body')}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {listing.cards.map(card => (
              <LocalizedClientLink
                key={card.handle}
                href={`/collections/${card.handle}`}
                className="bb-skin-card group flex min-h-[320px] flex-col overflow-hidden motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-reduce:transform-none"
                aria-label={t('grid.cardAria', { title: card.title })}
                data-testid="collection-item"
              >
                <div className="relative min-h-[220px] overflow-hidden bg-[var(--bb-gradient-cream-soft)]">
                  {card.imageUrl ? (
                    <Image
                      src={card.imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03] motion-reduce:transform-none"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-primary">
                    {t(`bucketLabel.${card.bucket}`)}
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                  <div>
                    <h3 className="heading-sm text-primary">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-secondary">{card.excerpt}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-secondary">
                      {t('grid.itemCount', { count: card.itemCount })}
                    </span>
                    <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[var(--bb-tint-gold-08)] text-primary">
                      →
                    </span>
                  </div>
                </div>
              </LocalizedClientLink>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
