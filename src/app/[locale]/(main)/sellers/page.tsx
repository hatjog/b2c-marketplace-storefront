import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { clampRadius, type RadiusOption } from '@/components/atoms/RadiusSelector/clampRadius';
import { SellerMap } from '@/components/cells/SellerMap';
import { SellersPagination } from '@/components/cells/SellersPagination/SellersPagination';
import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import { SellersSearchForm } from '@/components/molecules/SellersSearchForm/SellersSearchForm';
import {
  SellersViewToggle,
  type SellersView
} from '@/components/molecules/SellersViewToggle/SellersViewToggle';
import { SellerCard } from '@/components/organisms/seller/SellerCard';
import { searchSellers, type SellerSortKey } from '@/lib/data/seller';
import { buildSellerAlternates } from '@/lib/seo/sellerAlternates';

export const revalidate = 60;

const DEFAULT_LIMIT = 24;
const DEFAULT_OFFSET = 0;
const DEFAULT_SORT: SellerSortKey = 'rating_desc';
const VALID_SORT_KEYS: ReadonlySet<SellerSortKey> = new Set<SellerSortKey>([
  'rating_desc',
  'name_asc',
  'name_desc'
]);

function parsePositiveInt(
  raw: string | string[] | undefined,
  fallback: number,
  { min, max }: { min: number; max: number }
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function parseString(raw: string | string[] | undefined, fallback = ''): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : fallback;
}

function parseSort(raw: string | string[] | undefined): SellerSortKey {
  const value = parseString(raw);
  return VALID_SORT_KEYS.has(value as SellerSortKey) ? (value as SellerSortKey) : DEFAULT_SORT;
}

function parseView(raw: string | string[] | undefined): SellersView {
  // Defensive — anything other than the literal "map" falls back to list,
  // preserves SEO surface for the default canonical view.
  return parseString(raw) === 'map' ? 'map' : 'list';
}

/**
 * Story v160-4-3 — parse a finite-number lat/lng from URL searchParams.
 * Returns `undefined` for missing, non-string, or non-finite inputs so the
 * downstream geolocation filter receives a clean signal (no `NaN` leaks).
 */
function parseFiniteNumber(raw: string | string[] | undefined): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value === '') return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const q = parseString(sp.q).trim();
  const city = parseString(sp.city).trim();

  const t = await getTranslations('seller.search');
  const tList = await getTranslations('seller.list');

  let title: string;
  if (q && city) {
    title = t('meta_title_query_city', { query: q, city });
  } else if (q) {
    title = t('meta_title_query', { query: q });
  } else if (city) {
    title = t('meta_title_city', { city });
  } else {
    title = tList('meta_title');
  }

  const description = tList('description');

  // Story v160-3-3: canonical strips query params (filter/search results
  // inherit canonical from the bare list URL — prevents indexing duplicates
  // for `?q=` / `?city=` / `?sort=` permutations). Hreflang map covers all
  // active locales with `x-default` → DEFAULT_LOCALE per Google docs.
  const alternates = buildSellerAlternates(locale, '');

  return {
    title,
    description,
    alternates,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description
    }
  };
}

export default async function SellersListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const limit = parsePositiveInt(sp.limit, DEFAULT_LIMIT, { min: 1, max: 100 });
  const offset = parsePositiveInt(sp.offset, DEFAULT_OFFSET, { min: 0, max: 10_000 });
  const q = parseString(sp.q).trim();
  const city = parseString(sp.city).trim();
  const sort = parseSort(sp.sort);
  const view = parseView(sp.view);

  // Story v160-4-3 — geolocation "Blisko mnie" filter parse.
  const nearMe = parseString(sp.nearMe) === '1';
  const userLat = parseFiniteNumber(sp.lat);
  const userLng = parseFiniteNumber(sp.lng);
  const radiusRaw = parseFiniteNumber(sp.radius);
  const radius: RadiusOption = clampRadius(radiusRaw);
  // Effective near-me only when toggle is on AND we have valid coords.
  const nearMeEffective = nearMe && typeof userLat === 'number' && typeof userLng === 'number';

  const t = await getTranslations('seller.list');
  const tSearch = await getTranslations('seller.search');
  const tSellerPage = await getTranslations('seller.shared');

  const { items: pageItems, total } = await searchSellers({
    q,
    city,
    sort,
    limit,
    offset,
    ...(nearMeEffective ? { userLat, userLng, radiusKm: radius } : {})
  });

  const hasActiveFilters = Boolean(q || city || nearMe);
  const preservedParams: Record<string, string> = {};
  if (q) preservedParams.q = q;
  if (city) preservedParams.city = city;
  if (sort && sort !== DEFAULT_SORT) preservedParams.sort = sort;
  // Story v160-4-3: preserve geolocation params on view toggle + pagination.
  if (nearMe) {
    preservedParams.nearMe = '1';
    preservedParams.radius = String(radius);
    if (typeof userLat === 'number') preservedParams.lat = userLat.toFixed(6);
    if (typeof userLng === 'number') preservedParams.lng = userLng.toFixed(6);
  }
  // Pagination preserves view so /sellers?view=map&offset=24 keeps the map.
  // SellersViewToggle ignores incoming `view` and rewrites per target.
  const paginationPreservedParams =
    view === 'map' ? { ...preservedParams, view: 'map' } : preservedParams;

  return (
    <main
      id="main-content"
      className="container py-8"
    >
      <StorefrontRouteStateSignal
        route="sellers"
        surface="listing"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="seller-listing"
      />
      <Breadcrumbs
        items={[
          { label: tSellerPage('home'), href: '/' },
          { label: tSellerPage('salons'), href: '/sellers' }
        ]}
      />

      <h1 className="mb-2 mt-6 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 text-sm text-gray-500">{t('description')}</p>

      <SellersViewToggle
        locale={locale}
        view={view}
        preservedParams={preservedParams}
      />

      <SellersSearchForm
        locale={locale}
        q={q}
        city={city}
        sort={sort}
        nearMe={nearMe}
        radius={radius}
        lat={userLat}
        lng={userLng}
      />

      <p
        className="mb-4 text-sm text-gray-500"
        data-testid="sellers-list-results-count"
      >
        {tSearch('results_count', { count: total })}
      </p>

      {view === 'map' ? (
        <div
          className="mb-6"
          data-testid="sellers-list-map-view"
        >
          <SellerMap
            sellers={pageItems}
            locale={locale}
            userLat={nearMeEffective ? userLat : undefined}
            userLng={nearMeEffective ? userLng : undefined}
            radiusKm={nearMeEffective ? radius : undefined}
          />
        </div>
      ) : pageItems.length === 0 ? (
        <div
          data-testid="sellers-list-empty"
          className="py-12 text-center"
        >
          <h2
            className="mb-2 text-lg font-semibold"
            data-testid="sellers-list-empty-heading"
          >
            {nearMe
              ? t('no_results_in_radius', { radius: String(radius) })
              : hasActiveFilters
                ? tSearch('empty_heading_filtered', { query: q || city })
                : tSearch('empty_heading')}
          </h2>
          <p className="mb-6 text-sm text-gray-500">{tSearch('empty_body')}</p>
          {hasActiveFilters && (
            <Link
              href={`/${locale}/sellers`}
              className="inline-block rounded-sm border border-primary px-6 py-3 text-primary hover:bg-primary/10"
              aria-label={tSearch('clear_filters_aria')}
              data-testid="sellers-list-clear-filters"
            >
              {tSearch('clear_filters')}
            </Link>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6"
          data-testid="sellers-list-grid"
        >
          {pageItems.map(seller => (
            <SellerCard
              key={seller.handle}
              name={seller.name}
              handle={seller.handle}
              photo_url={seller.photo_url}
              city={seller.city}
              product_count={seller.product_count}
            />
          ))}
        </div>
      )}

      <SellersPagination
        locale={locale}
        total={total}
        limit={limit}
        offset={offset}
        preservedParams={paginationPreservedParams}
      />
    </main>
  );
}
