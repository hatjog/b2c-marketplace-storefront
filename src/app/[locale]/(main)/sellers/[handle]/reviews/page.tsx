import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { Button } from '@/components/atoms/Button/Button';
import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { SellersDetailLayout } from '@/components/templates/SellersDetailLayout';
import { retrieveCustomer } from '@/lib/data/customer';
import { getRegion } from '@/lib/data/regions';
import { getSellerReviewsSurfaceData, type SellerReviewSortKey } from '@/lib/data/seller-reviews';
import { getCountryCode } from '@/lib/helpers/country-code';
import { buildSellerAlternates } from '@/lib/seo/sellerAlternates';

export const revalidate = 60;

const SORT_KEYS: SellerReviewSortKey[] = ['newest', 'highest', 'lowest'];

function resolveSort(value: string | string[] | undefined): SellerReviewSortKey {
  return SORT_KEYS.includes(value as SellerReviewSortKey)
    ? (value as SellerReviewSortKey)
    : 'newest';
}

function resolveRating(value: string | string[] | undefined) {
  const parsed = Number.parseInt(Array.isArray(value) ? (value[0] ?? '') : (value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

function resolvePage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(Array.isArray(value) ? (value[0] ?? '') : (value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function formatRatingStars(rating: number) {
  return `${'★'.repeat(rating)}${'☆'.repeat(Math.max(0, 5 - rating))}`;
}

function formatReviewDate(locale: string, value: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function buildQueryString(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '' || value === 'newest' || value === 1) {
      return;
    }

    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

async function loadPageData({
  locale,
  handle,
  sort,
  rating,
  page
}: {
  locale: string;
  handle: string;
  sort: SellerReviewSortKey;
  rating: number | null;
  page: number;
}) {
  const countryCode = await getCountryCode(locale);
  const currencyCode = (await getRegion(countryCode))?.currency_code || 'pln';

  return getSellerReviewsSurfaceData({
    handle,
    locale,
    countryCode,
    currencyCode,
    sort,
    rating,
    page
  });
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; handle: string }>;
}): Promise<Metadata> {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('seller.reviews_v180.meta');
  const data = await loadPageData({
    locale,
    handle,
    sort: 'newest',
    rating: null,
    page: 1
  });

  if (!data) {
    return {
      title: t('fallbackTitle'),
      description: t('fallbackDescription'),
      alternates: buildSellerAlternates(locale, `/${handle}/reviews`),
      robots: { index: false, follow: false }
    };
  }

  return {
    title: t('title', { name: data.seller.name }),
    description: t('description', {
      name: data.seller.name,
      count: data.totalReviews
    }),
    metadataBase: new URL(await getBaseUrl()),
    alternates: buildSellerAlternates(locale, `/${handle}/reviews`),
    robots: { index: true, follow: true },
    openGraph: {
      title: t('title', { name: data.seller.name }),
      description: t('description', {
        name: data.seller.name,
        count: data.totalReviews
      }),
      ...(data.seller.imageUrl ? { images: [{ url: data.seller.imageUrl }] } : {})
    }
  };
}

export default async function SellerReviewsPage({
  params,
  searchParams
}: {
  params: Promise<{ handle: string; locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle, locale } = await params;
  setRequestLocale(locale);
  const resolvedSearchParams = (await searchParams) ?? {};
  const sort = resolveSort(resolvedSearchParams.sort);
  const rating = resolveRating(resolvedSearchParams.rating);
  const page = resolvePage(resolvedSearchParams.page);
  const [t, tShared, user, data] = await Promise.all([
    getTranslations('seller.reviews_v180'),
    getTranslations('seller.shared'),
    retrieveCustomer(),
    loadPageData({ locale, handle, sort, rating, page })
  ]);

  if (!data) {
    notFound();
  }

  const backHref = `/${locale}/sellers/${data.seller.handle}`;

  return (
    <SellersDetailLayout
      surface="W4-03"
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: tShared('breadcrumb_home'), href: `/${locale}/` },
            { label: tShared('breadcrumb_sellers'), href: `/${locale}/sellers` },
            { label: data.seller.name, href: backHref },
            { label: t('breadcrumbs.reviews'), href: `${backHref}/reviews` }
          ]}
        />
      }
      hero={
        <>
          <StorefrontRouteStateSignal
            route="seller-reviews"
            surface="listing"
          />
          <section
            className="bb-skin-card overflow-hidden"
            data-testid="seller-reviews-hero"
          >
            <div className="grid gap-4 p-5 md:grid-cols-[120px_minmax(0,1fr)] md:p-6">
              <div className="relative min-h-[120px] overflow-hidden rounded-[var(--bb-radius-panel)] bg-[var(--bb-gradient-cream-wisp)]">
                {data.seller.imageUrl ? (
                  <Image
                    src={data.seller.imageUrl}
                    alt={data.seller.name}
                    fill
                    sizes="120px"
                    className="object-cover"
                    priority
                  />
                ) : null}
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={backHref}
                    className="label-sm text-secondary underline underline-offset-4"
                  >
                    {t('backToSeller')}
                  </Link>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bb-tint-gold-12)] px-3 py-1 text-xs font-medium text-primary">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-trust)] text-white"
                    >
                      ✓
                    </span>
                    {t('verifiedBadge')}
                  </span>
                </div>
                <div className="space-y-2">
                  <h1 className="heading-lg text-primary">
                    {t('title', { name: data.seller.name })}
                  </h1>
                  <p className="label-md text-secondary">
                    {[data.seller.district, data.seller.city].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-sm text-secondary">{t('intro', { name: data.seller.name })}</p>
                </div>
              </div>
            </div>
          </section>
        </>
      }
      summary={
        <>
          <section
            className="bb-skin-panel p-5"
            aria-labelledby="seller-reviews-summary-heading"
            data-testid="seller-reviews-summary"
          >
            <p className="label-sm text-secondary">{t('summary.eyebrow')}</p>
            <h2
              id="seller-reviews-summary-heading"
              className="heading-md mt-2 text-primary"
            >
              {data.averageRating == null ? t('summary.noRating') : data.averageRating.toFixed(1)}
            </h2>
            <p className="mt-2 text-sm text-secondary">
              {t('summary.ratingLabel', { count: data.totalReviews })}
            </p>
            <div className="mt-5 space-y-3">
              {data.breakdown.map(row => (
                <div
                  key={row.rating}
                  className="grid grid-cols-[52px_minmax(0,1fr)_40px] items-center gap-3 text-sm"
                >
                  <span className="text-primary">
                    {t('summary.ratingLine', { rating: row.rating })}
                  </span>
                  <div
                    className="h-2 rounded-full bg-[var(--bb-tint-gold-12)]"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--cta)]"
                      style={{ width: `${Math.max(row.share * 100, row.count > 0 ? 10 : 0)}%` }}
                    />
                  </div>
                  <span className="text-right text-secondary">{row.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="bb-skin-panel p-5"
            aria-labelledby="seller-reviews-filters-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="seller-reviews-filters-heading"
                className="heading-sm text-primary"
              >
                {t('filters.heading')}
              </h2>
              {data.activeRating ? (
                <LocalizedClientLink
                  href={`/sellers/${data.seller.handle}/reviews${buildQueryString({ sort })}`}
                  className="text-sm text-secondary underline underline-offset-4"
                >
                  {t('filters.clear')}
                </LocalizedClientLink>
              ) : null}
            </div>

            <div
              className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:overflow-visible"
              role="list"
              aria-label={t('filters.aria')}
              data-testid="seller-reviews-filter-pills"
            >
              {[5, 4, 3, 2, 1].map(value => {
                const isActive = data.activeRating === value;

                return (
                  <LocalizedClientLink
                    key={value}
                    href={`/sellers/${data.seller.handle}/reviews${buildQueryString({
                      sort,
                      rating: isActive ? null : value
                    })}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center justify-between gap-3 rounded-full border px-4 py-2 text-sm lg:rounded-[var(--bb-radius-panel)] ${
                      isActive
                        ? 'border-[var(--cta)] bg-[var(--bb-tint-gold-12)] text-primary'
                        : 'border-[var(--bb-tint-gold-16)] text-secondary'
                    }`}
                  >
                    <span>{t('filters.ratingChip', { rating: value })}</span>
                    <span className="text-xs">
                      {data.breakdown.find(row => row.rating === value)?.count ?? 0}
                    </span>
                  </LocalizedClientLink>
                );
              })}
            </div>
          </section>
        </>
      }
      content={
        <section
          className="space-y-4"
          data-testid="seller-reviews-page"
        >
          <div className="bb-skin-panel flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="heading-sm text-primary">{t('list.heading')}</h2>
              <p className="mt-1 text-sm text-secondary">
                {t('list.results', {
                  count: rating ? data.visibleReviews.length : data.totalReviews
                })}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="toolbar"
              aria-label={t('sort.aria')}
              data-testid="seller-reviews-sort"
            >
              {SORT_KEYS.map(key => {
                const active = data.sort === key;

                return (
                  <LocalizedClientLink
                    key={key}
                    href={`/sellers/${data.seller.handle}/reviews${buildQueryString({
                      sort: key,
                      rating: data.activeRating,
                      page: 1
                    })}`}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm ${
                      active
                        ? 'bg-[var(--cta)] text-white'
                        : 'bg-[var(--bb-tint-gold-08)] text-primary'
                    }`}
                  >
                    {t(`sort.${key}`)}
                  </LocalizedClientLink>
                );
              })}
            </div>
          </div>

          {data.totalReviews === 0 ? (
            <StateCard
              variant="empty"
              title={t('empty.title')}
              description={t('empty.body')}
              titleId="seller-reviews-empty-heading"
              data-testid="seller-reviews-empty-state"
              action={
                user ? (
                  <LocalizedClientLink href={`/sellers/${data.seller.handle}`}>
                    <Button>{t('empty.loggedInCta')}</Button>
                  </LocalizedClientLink>
                ) : (
                  <LocalizedClientLink href="/login">
                    <Button>{t('empty.guestCta')}</Button>
                  </LocalizedClientLink>
                )
              }
            />
          ) : (
            <div
              className="space-y-4"
              data-testid="seller-reviews-list"
            >
              {data.visibleReviews.map(review => {
                const isLong = review.body.length > 220;

                return (
                  <article
                    key={review.id}
                    className="bb-skin-card p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="heading-sm text-primary">{review.author}</h3>
                          {review.verifiedVisit ? (
                            <span className="inline-flex min-h-8 items-center rounded-full bg-[var(--bb-trust-tint-10)] px-3 py-1 text-xs font-medium text-[var(--color-trust)]">
                              {t('list.verifiedVisit')}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary">
                          <span>{formatReviewDate(locale, review.createdAt)}</span>
                          {review.serviceName ? <span>{review.serviceName}</span> : null}
                        </div>
                      </div>
                      <div
                        className="inline-flex items-center gap-3 rounded-full bg-[var(--bb-tint-gold-08)] px-4 py-2 text-sm text-primary"
                        aria-label={t('list.ratingAria', { rating: review.rating })}
                      >
                        <span aria-hidden="true">{formatRatingStars(review.rating)}</span>
                        <span>{t('list.ratingVisible', { rating: review.rating })}</span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      {isLong ? (
                        <details className="group">
                          <summary className="cursor-pointer list-none text-sm text-primary marker:hidden">
                            <span className="line-clamp-4 block group-open:line-clamp-none">
                              {review.body}
                            </span>
                            <span className="mt-3 inline-flex text-sm text-secondary underline underline-offset-4">
                              {t('list.expand')}
                            </span>
                          </summary>
                        </details>
                      ) : (
                        <p className="text-sm leading-7 text-primary">{review.body}</p>
                      )}

                      {review.sellerReply ? (
                        <section className="rounded-[var(--bb-radius-panel)] bg-[var(--bb-tint-gold-08)] p-4">
                          <p className="label-sm text-secondary">{t('list.replyLabel')}</p>
                          <p className="mt-2 text-sm leading-7 text-primary">
                            {review.sellerReply}
                          </p>
                        </section>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {data.totalReviews > 0 ? (
            <nav
              className="bb-skin-panel flex flex-wrap items-center justify-between gap-3 p-5"
              aria-label={t('pagination.aria')}
            >
              <p className="text-sm text-secondary">
                {t('pagination.status', { page: data.page, totalPages: data.totalPages })}
              </p>
              <div className="flex gap-2">
                <LocalizedClientLink
                  href={`/sellers/${data.seller.handle}/reviews${buildQueryString({
                    sort: data.sort,
                    rating: data.activeRating,
                    page: Math.max(1, data.page - 1)
                  })}`}
                  aria-disabled={!data.hasPreviousPage}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm ${
                    data.hasPreviousPage
                      ? 'bg-[var(--bb-tint-gold-08)] text-primary'
                      : 'pointer-events-none bg-[var(--bb-tint-gold-05)] text-secondary/60'
                  }`}
                >
                  {t('pagination.previous')}
                </LocalizedClientLink>
                <LocalizedClientLink
                  href={`/sellers/${data.seller.handle}/reviews${buildQueryString({
                    sort: data.sort,
                    rating: data.activeRating,
                    page: data.page + 1
                  })}`}
                  aria-disabled={!data.hasNextPage}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm ${
                    data.hasNextPage
                      ? 'bg-[var(--cta)] text-white'
                      : 'pointer-events-none bg-[var(--bb-tint-gold-05)] text-secondary/60'
                  }`}
                >
                  {t('pagination.next')}
                </LocalizedClientLink>
              </div>
            </nav>
          ) : null}
        </section>
      }
      ctaBar={
        <div className="sticky bottom-0 z-20 border-t border-[var(--bb-border-soft)] bg-[var(--bb-surface-96)] px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="container flex items-center justify-between gap-4">
            <div className="hidden md:block">
              <p className="label-sm text-secondary">{t('verifiedBadge')}</p>
              <p className="label-md text-primary">{data.seller.displayName}</p>
            </div>
            <LocalizedClientLink
              href={backHref}
              className="ml-auto inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--cta)] px-5 py-2 text-sm font-medium text-white"
            >
              {t('backToSeller')}
            </LocalizedClientLink>
          </div>
        </div>
      }
    />
  );
}
