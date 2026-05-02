import type { HttpTypes } from '@medusajs/types';

import {
  ProductListingActiveFilters,
  ProductListingHeader,
  ProductSidebar,
  ProductsList,
  ProductsPagination
} from '@/components/organisms';
import type { StorefrontFilterConfig } from '@/components/cells/DynamicFilterSidebar/DynamicFilterSidebar';
import { PRODUCT_LIMIT } from '@/const';
import { SORT_OPTIONS } from '@/lib/constants';
import type { SortOption } from '@/lib/constants';
import { listCategories } from '@/lib/data/categories';
import type { ProductQueryParams } from '@/lib/data/products';
import { listProductsWithSort, listProductTags, listSellerCities, searchProducts } from '@/lib/data/products';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { sanitizeTagIdList } from '@/lib/helpers/sanitize-tag-id';
import { resolveMarketConfig } from '@/lib/portal.server';
import { getTranslations } from 'next-intl/server';
import { ClearFiltersButton } from './ClearFiltersButton';

type Category = { id: string; name: string; handle: string };
type Tag = { id: string; value: string };

const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const CITY_ALLOWED_CHARS_RE = /[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g;
const ALLOWED_DURATIONS = [30, 45, 60, 90] as const;

/** Sanitize URL search params to prevent injection / malformed API calls. */
function sanitizeSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = (key: string): string | undefined =>
    typeof searchParams[key] === 'string' ? searchParams[key] : undefined;

  const rawMin = raw('min_price');
  const rawMax = raw('max_price');
  const rawTagId = raw('tag_id');
  const rawCategoryHandle = raw('category_handle');
  const rawCity = raw('city');
  const rawDuration = raw('duration');
  const rawSellerRating = raw('seller_rating');
  const rawPage = raw('page');
  const rawQuery = raw('query');

  const parsedMin = rawMin != null ? Number(rawMin) : NaN;
  const parsedMax = rawMax != null ? Number(rawMax) : NaN;

  // cities: split by comma, validate each element (max 100 chars, strip non-allowed chars)
  const cities: string[] = rawCity
    ? rawCity
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(c => (c.length <= 100 ? c.replace(CITY_ALLOWED_CHARS_RE, '').trim() : ''))
        .filter(Boolean)
    : [];

  // durations: split by comma, parseInt each, validate against allowlist
  const durations: number[] = rawDuration
    ? rawDuration
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && (ALLOWED_DURATIONS as readonly number[]).includes(n))
    : [];

  // sellerRatings: split by comma, parseInt each, validate range [1, 5]
  const sellerRatings: number[] = rawSellerRating
    ? rawSellerRating
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 5)
    : [];

  // tagIds: split by comma, NFC-normalize, ASCII-narrow, then validate each
  // candidate (UUID / legacy alphanumeric / kebab-case / stable config ID).
  // Allowlist includes BonBeauty StyleSection kebab-case forms (e.g. `k-beauty`)
  // — see lib/helpers/sanitize-tag-id.ts.
  const tagIds: string[] = sanitizeTagIdList(rawTagId);

  // page: integer [1, 999]
  const page = rawPage ? Math.max(1, Math.min(999, parseInt(rawPage, 10) || 1)) : 1;

  return {
    minPrice: !Number.isNaN(parsedMin) && parsedMin >= 0 ? String(parsedMin) : undefined,
    maxPrice: !Number.isNaN(parsedMax) && parsedMax >= 0 ? String(parsedMax) : undefined,
    tagIds,
    categoryHandle: rawCategoryHandle && HANDLE_RE.test(rawCategoryHandle) ? rawCategoryHandle : undefined,
    query: rawQuery?.trim() || undefined,
    cities,
    durations,
    sellerRatings,
    page
  };
}

function normalizeFilters(raw: unknown): StorefrontFilterConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is StorefrontFilterConfig =>
      typeof f === 'object' && f !== null && typeof f.type === 'string' && typeof f.label_key === 'string'
  );
}

export const ProductListing = async ({
  category_id,
  collection_id,
  seller_id,
  showSidebar = false,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'pl',
  searchParams = {},
  fromContext
}: {
  category_id?: string | string[];
  collection_id?: string;
  seller_id?: string;
  showSidebar?: boolean;
  locale?: string;
  searchParams?: Record<string, string | string[] | undefined>;
  /**
   * Story v160-4-6: optional salon-anchored context — when set, product cards
   * augment hrefs with `?from=seller:{handle}` so PDP renders the
   * SalonContextChip overlay. Set by SellerTabs when listing rendered in
   * salon detail context.
   */
  fromContext?: { type: 'seller'; handle: string };
}) => {
  // Resolve & sanitize filter params from URL search params
  const { categoryHandle, minPrice, maxPrice, query, tagIds, cities, durations, sellerRatings, page } = sanitizeSearchParams(searchParams);

  // Resolve sort option — validate against allowlist, default to 'recommended'
  const rawSort = typeof searchParams.sort === 'string' ? searchParams.sort : undefined;
  const sortBy: SortOption = (SORT_OPTIONS as readonly string[]).includes(rawSort ?? '') ? (rawSort as SortOption) : 'recommended';

  // ADR-046: resolve country code from cookie, not from locale URL segment
  const countryCode = await getCountryCode(locale);
  const t = await getTranslations('filters');

  // Fetch market config for storefront filters
  const marketId = getMarketId();
  const storefrontFilters: StorefrontFilterConfig[] = [];
  let categories: Category[] = [];
  let tags: Tag[] = [];
  let sidebarCities: string[] = [];

  if (showSidebar && !marketId) {
    console.warn(
      '[ProductListing] showSidebar=true but marketId is empty — check NEXT_PUBLIC_PAYLOAD_MARKET_ID env var'
    );
  }

  if (showSidebar && marketId) {
    try {
      const { marketConfig } = await resolveMarketConfig(marketId);
      const rawFilters = normalizeFilters(marketConfig.storefront_filters);
      storefrontFilters.push(...rawFilters);

      const needsCategories = rawFilters.some(f => f.type === 'category_group');
      if (needsCategories) {
        const { categories: cats } = await listCategories();
        categories = cats.map(c => ({ id: c.id, name: c.name, handle: c.handle }));
      }

      const needsTags = rawFilters.some(f => f.type === 'tag_group');
      if (needsTags) {
        const tagGroupFilter = rawFilters.find(f => f.type === 'tag_group');
        tags = await listProductTags(tagGroupFilter?.tag_group);
      }

      const needsCities = rawFilters.some(f => f.type === 'location');
      if (needsCities) {
        sidebarCities = await listSellerCities();
      }
    } catch (err) {
      // Sidebar filters not critical — listing still works without them.
      // Log the error to diagnose /categories sidebar not rendering (Task 8 bug).
      console.error(
        '[ProductListing] resolveMarketConfig failed — sidebar filters not loaded:',
        { marketId, error: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  // Resolve category_id from URL handle if provided
  let resolvedCategoryId = category_id;
  if (categoryHandle && categories.length > 0) {
    const matched = categories.find(c => c.handle === categoryHandle);
    if (matched) resolvedCategoryId = matched.id;
  }

  const queryParams: ProductQueryParams = {
    ...(minPrice ? { min_price: minPrice } : {}),
    ...(maxPrice ? { max_price: maxPrice } : {})
  };

  let totalFiltered = 0;
  let pages = 0;
  let paginatedProducts: HttpTypes.StoreProduct[] = [];

  try {
    if (query) {
      const searchResult = await searchProducts({
        query,
        page: page - 1,
        hitsPerPage: PRODUCT_LIMIT,
        countryCode,
      });

      totalFiltered = searchResult.nbHits;
      pages = searchResult.nbPages;
      paginatedProducts = searchResult.products;
    } else {
      const { response } = await listProductsWithSort({
        seller_id,
        category_id: resolvedCategoryId,
        collection_id,
        countryCode,
        sortBy,
        queryParams,
        cities,
        tagIds,
        durations,
        sellerRatings,
        page,
        limit: PRODUCT_LIMIT,
      });

      totalFiltered = response.count;
      pages = Math.ceil(totalFiltered / PRODUCT_LIMIT);
      paginatedProducts = response.products;
    }
  } catch {
    return (
      <div className="py-12 text-center" data-testid="product-listing-error">
        <p>{t('load_error')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2" data-testid="product-listing-container">
      <div className="bb-section-shell bb-section-shell-strong space-y-4">
        <ProductListingHeader total={totalFiltered} />
        <div className="hidden md:block">
          <ProductListingActiveFilters />
        </div>
      </div>
      <div className={`grid grid-cols-1 gap-6 ${showSidebar ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : ''}`}>
        {showSidebar && (
          <ProductSidebar
            filters={storefrontFilters}
            categories={categories}
            tags={tags}
            cities={sidebarCities}
          />
        )}
        <section
          className={showSidebar ? 'space-y-6' : 'col-span-full space-y-6'}
          data-testid="product-listing-section"
        >
          {paginatedProducts.length === 0 ? (
            <div className="bb-section-shell flex flex-col items-center gap-4 py-12" data-testid="empty-state">
              <p>{t('no_results')}</p>
              <ClearFiltersButton />
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${showSidebar ? 'xl:grid-cols-2' : 'xl:grid-cols-3'}`}
              data-testid="product-list"
            >
              <ProductsList products={paginatedProducts} fromContext={fromContext} />
            </div>
          )}
          {pages > 1 && (
            <div className="bb-section-shell">
              <ProductsPagination pages={pages} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
