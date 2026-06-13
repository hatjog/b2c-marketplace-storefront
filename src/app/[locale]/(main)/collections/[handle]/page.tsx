import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { Button } from '@/components/atoms/Button/Button';
import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { BlogLayout } from '@/components/templates/BlogLayout';
import {
  getEditorialCollectionDetail,
  type EditorialCollectionSortKey
} from '@/lib/data/editorial-collections';
import { buildLocaleAlternates } from '@/lib/seo/hreflang';

export const revalidate = 60;

const SORT_KEYS: EditorialCollectionSortKey[] = ['curated', 'title-asc', 'title-desc'];

function resolveSort(value: string | string[] | undefined): EditorialCollectionSortKey {
  return SORT_KEYS.includes(value as EditorialCollectionSortKey)
    ? (value as EditorialCollectionSortKey)
    : 'curated';
}

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

function buildAlternates(baseUrl: string, locale: string, handle: string) {
  // SSOT hreflang builder → canonical BCP47 keys (pl-PL/en-US/uk-UA/de-DE) + x-default.
  // Pre-v1.10.0 this emitted bare locale codes (pl/en/ua/de), which are non-canonical
  // for <link rel="alternate" hreflang> and broke parity with PDP/category/seller routes.
  return buildLocaleAlternates(locale, loc => `/${loc}/collections/${handle}`, baseUrl);
}

function buildQueryString(sort: EditorialCollectionSortKey) {
  if (sort === 'curated') {
    return '';
  }

  return `?sort=${sort}`;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; handle: string }>;
}): Promise<Metadata> {
  const { locale, handle } = await params;
  const t = await getTranslations('collections_editorial_v180.detail.meta');
  const data = await getEditorialCollectionDetail({ handle, locale });

  if (!data) {
    return {
      title: t('fallbackTitle'),
      description: t('fallbackDescription'),
      robots: { index: false, follow: false }
    };
  }

  const baseUrl = await getBaseUrl();

  return {
    title: t('title', { title: data.title }),
    description: t('description', { title: data.title, count: data.itemCount }),
    metadataBase: new URL(baseUrl),
    alternates: buildAlternates(baseUrl, locale, handle),
    robots: { index: true, follow: true },
    openGraph: {
      title: t('title', { title: data.title }),
      description: t('description', { title: data.title, count: data.itemCount }),
      ...(data.imageUrl ? { images: [{ url: data.imageUrl }] } : {})
    }
  };
}

export default async function CollectionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, handle } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const sort = resolveSort(resolvedSearchParams.sort);
  const [t, data] = await Promise.all([
    getTranslations('collections_editorial_v180.detail'),
    getEditorialCollectionDetail({ handle, locale, sort })
  ]);

  if (!data) {
    notFound();
  }

  return (
    <BlogLayout
      surface="W4-05"
      breadcrumbs={
        <>
          <StorefrontRouteStateSignal
            route="collection-detail"
            surface="listing"
          />
          <Breadcrumbs
            items={[
              { label: t('breadcrumbs.home'), href: `/${locale}/` },
              { label: t('breadcrumbs.collections'), href: `/${locale}/collections` },
              { label: data.title, href: `/${locale}/collections/${data.handle}` }
            ]}
          />
        </>
      }
      hero={
        <section
          className="bb-skin-hero relative px-6 py-8 text-white md:px-8 md:py-10"
          data-testid="collection-detail-hero"
        >
          <div
            className={`absolute inset-0 ${
              data.overlay === 'dark'
                ? 'bg-[var(--bb-gradient-dark-warm)]'
                : data.overlay === 'warm'
                  ? 'bg-[var(--bb-dark-gradient)]'
                  : 'bg-[var(--bb-gradient-dark-warm)]'
            }`}
          />
          {data.imageUrl ? (
            <div className="absolute inset-0 opacity-35">
              <Image
                src={data.imageUrl}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
            <div className="space-y-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/70">
                {t('eyebrow')}
              </p>
              <div className="space-y-3">
                <h1 className="heading-xl max-w-[14ch]">{data.title}</h1>
                <p className="text-white/82 max-w-2xl text-sm leading-7">{data.intro}</p>
              </div>
              <div className="border-white/14 rounded-[var(--bb-radius-panel)] border bg-white/10 p-4 backdrop-blur-sm">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/65">
                  {t('calloutLabel')}
                </p>
                <p className="mt-3 text-sm leading-7 text-white/85">{data.callout}</p>
              </div>
            </div>

            <aside className="border-white/12 rounded-[var(--bb-radius-card)] border bg-white/10 p-5 backdrop-blur-sm">
              <p className="label-sm text-white/70">{t('quoteLabel')}</p>
              <blockquote className="heading-sm mt-3 text-white">“{data.quote}”</blockquote>
              <p className="mt-4 text-sm text-white/70">{data.quoteAttribution}</p>
            </aside>
          </div>
        </section>
      }
      content={
        <section
          className="space-y-5"
          data-testid="collection-detail-page"
        >
          <div
            className="bb-skin-panel flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
            data-testid="collection-detail-toolbar"
          >
            <div>
              <h2 className="heading-sm text-primary">{t('toolbar.title')}</h2>
              <p className="mt-1 text-sm text-secondary">
                {t('toolbar.count', { count: data.itemCount })}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="toolbar"
              aria-label={t('toolbar.sortAria')}
            >
              {SORT_KEYS.map(option => {
                const active = data.sort === option;

                return (
                  <LocalizedClientLink
                    key={option}
                    href={`/collections/${data.handle}${buildQueryString(option)}`}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm ${
                      active
                        ? 'bg-[var(--cta)] text-[var(--text-on-action)]'
                        : 'bg-[var(--bb-tint-gold-08)] text-primary'
                    }`}
                  >
                    {t(`toolbar.sort.${option}`)}
                  </LocalizedClientLink>
                );
              })}
            </div>
          </div>

          {data.isEmpty ? (
            <StateCard
              variant="empty"
              title={t('empty.title')}
              description={t('empty.body')}
              titleId="collection-empty-heading"
              data-testid="collection-detail-empty-state"
              action={
                <LocalizedClientLink href="/collections">
                  <Button>{t('empty.cta')}</Button>
                </LocalizedClientLink>
              }
            />
          ) : (
            <div
              id="collection-items"
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              data-testid="collection-detail-grid"
            >
              {data.items.map(item => (
                <LocalizedClientLink
                  key={item.id}
                  href={`/products/${item.handle}`}
                  className="bb-skin-card group flex min-h-[280px] flex-col overflow-hidden motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-reduce:transform-none"
                  aria-label={t('grid.cardAria', { title: item.title })}
                >
                  <div className="relative min-h-[200px] bg-[var(--bb-gradient-cream-card)]">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03] motion-reduce:transform-none"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.22em] text-secondary">
                        {t('grid.curatedLabel')}
                      </p>
                      <h3 className="heading-sm mt-3 text-primary">{item.title}</h3>
                    </div>
                    <span className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
                      {t('grid.cta')}
                    </span>
                  </div>
                </LocalizedClientLink>
              ))}
            </div>
          )}
        </section>
      }
      related={
        <section
          className="space-y-5"
          data-testid="collection-detail-related"
        >
          <div className="max-w-3xl">
            <h2 className="heading-lg text-primary">{t('related.title')}</h2>
            <p className="mt-3 text-sm leading-7 text-secondary">{t('related.body')}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {data.related.map(collection => (
              <LocalizedClientLink
                key={collection.handle}
                href={`/collections/${collection.handle}`}
                className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white p-5 shadow-[0_16px_40px_rgba(90,67,28,0.08)]"
                aria-label={t('related.cardAria', { title: collection.title })}
              >
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-secondary">
                  {t(`bucketLabel.${collection.bucket}`)}
                </p>
                <h3 className="heading-sm mt-3 text-primary">{collection.title}</h3>
                <p className="mt-3 text-sm leading-7 text-secondary">{collection.excerpt}</p>
              </LocalizedClientLink>
            ))}
          </div>
        </section>
      }
    />
  );
}
