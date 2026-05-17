/**
 * ProductListing — v1.7.0 Story 2.2 update.
 *
 * Changes:
 *   - Error state uses DiscoveryEmptyState variant="load-error" (StateCard error)
 *     instead of raw <p> + inline text — per UX-DR18 (no raw API errors in UI).
 *   - No-results state uses DiscoveryEmptyState variant="no-results" with
 *     ClearFiltersButton as the action slot — semantically and visually distinct.
 *   - Both states have role="alert"/"region", aria-live, and accessible status text.
 *   - Submit-load (filter/sort change in AlgoliaProductsListing) tracked via
 *     aria-busy on ProductListingLoadingView (see molecule).
 */
import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import {
  ProductListingActiveFilters,
  ProductListingHeader,
  ProductSidebar,
  ProductsList,
  ProductsPagination
} from '@/components/organisms';
import type { StorefrontFilterConfig } from '@/components/cells/DynamicFilterSidebar/DynamicFilterSidebar';
import { DiscoveryEmptyState } from '@/components/cells/DiscoveryEmptyState/DiscoveryEmptyState';
import { CategoryPlpContextualCta } from '@/components/sections/CategoryPlp/CategoryPlpContextualCta';
import { CategoryPlpNoResults } from '@/components/sections/CategoryPlp/CategoryPlpNoResults';
import { CategoryPlpSidebar } from '@/components/sections/CategoryPlp/CategoryPlpSidebar';
import { PRODUCT_LIMIT } from '@/const';
import { SORT_OPTIONS } from '@/lib/constants';
import type { SortOption } from '@/lib/constants';
import { listCategories } from '@/lib/data/categories';
import type { ProductQueryParams } from '@/lib/data/products';
import { listProductsWithSort, listProductTags, listSellerCities, searchProducts } from '@/lib/data/products';
import { getRegion } from '@/lib/data/regions';
import { getSellers } from '@/lib/data/seller';
import { applyCategoryPlpSemanticFilters } from '@/lib/helpers/category-plp-semantic-filters';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { parsePurchaseMode } from '@/lib/helpers/parse-purchase-mode';
import type { SelfPurchaseMode } from '@/lib/helpers/parse-purchase-mode';
import { sanitizeTagIdList } from '@/lib/helpers/sanitize-tag-id';
import { resolveMarketConfig } from '@/lib/portal.server';
import { ClearFiltersButton } from './ClearFiltersButton';
import { ListingRetryButton } from './ListingRetryButton';

type Category = { id: string; name: string; handle: string };
type Tag = { id: string; value: string };
type SalonOption = { handle: string; name: string };

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
  const rawSalon = raw('salon');
  const rawAvailability = raw('availability');
  const rawMode = raw('mode');

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
    page,
    salonHandle: rawSalon && HANDLE_RE.test(rawSalon) ? rawSalon : undefined,
    availability: rawAvailability === 'in_stock' ? ('in_stock' as const) : undefined,
    purchaseMode: parsePurchaseMode(rawMode)
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
  categoryPlp = false,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'pl',
  searchParams = {},
  fromContext
}: {
  category_id?: string | string[];
  collection_id?: string;
  seller_id?: string;
  showSidebar?: boolean;
  categoryPlp?: boolean;
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
  const {
    categoryHandle,
    minPrice,
    maxPrice,
    query,
    tagIds,
    cities,
    durations,
    sellerRatings,
    page,
    salonHandle,
    availability,
    purchaseMode,
  } = sanitizeSearchParams(searchParams);

  // Resolve sort option — validate against allowlist, default to 'recommended'
  const rawSort = typeof searchParams.sort === 'string' ? searchParams.sort : undefined;
  const sortBy: SortOption = (SORT_OPTIONS as readonly string[]).includes(rawSort ?? '') ? (rawSort as SortOption) : 'recommended';

  // ADR-046: resolve country code from cookie, not from locale URL segment
  const countryCode = await getCountryCode(locale);
  const region = await getRegion(countryCode);
  const currencyCode = (region?.currency_code ?? 'PLN').toUpperCase();
  const semanticFilters: {
    salonHandle?: string;
    availability?: 'in_stock';
    purchaseMode?: SelfPurchaseMode;
  } | undefined = categoryPlp
    ? {
        salonHandle,
        availability,
        purchaseMode,
      }
    : undefined;

  // Fetch market config for storefront filters
  const marketId = getMarketId();
  const storefrontFilters: StorefrontFilterConfig[] = [];
  let categories: Category[] = [];
  let tags: Tag[] = [];
  let sidebarCities: string[] = [];
  let salonOptions: SalonOption[] = [];

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

  if (categoryPlp) {
    const salons = await getSellers();
    salonOptions = salons
      .filter(seller => seller.handle && seller.name)
      .map(seller => ({ handle: seller.handle, name: seller.name }));

    if (sidebarCities.length === 0) {
      sidebarCities = await listSellerCities();
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
        page: 0,
        hitsPerPage: 1000,
        countryCode,
      });

      const filteredSearchProducts = categoryPlp
        ? applyCategoryPlpSemanticFilters(searchResult.products, semanticFilters)
        : searchResult.products;

      totalFiltered = filteredSearchProducts.length;
      pages = Math.ceil(totalFiltered / PRODUCT_LIMIT);
      const offset = (page - 1) * PRODUCT_LIMIT;
      paginatedProducts = filteredSearchProducts.slice(offset, offset + PRODUCT_LIMIT);
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
        semanticFilters,
        page,
        limit: PRODUCT_LIMIT,
      });

      totalFiltered = response.count;
      pages = Math.ceil(totalFiltered / PRODUCT_LIMIT);
      paginatedProducts = response.products;
    }
  } catch (err) {
    // v1.7.0 Story 2.2 review fix (INFO I3): log the underlying error to the
    // server console so ops have a signal — catch was previously parameterless.
    // Raw API errors / stack traces never surface in UI per UX-DR18.
    console.error(
      '[ProductListing] product fetch failed:',
      err instanceof Error ? err.message : String(err)
    );
    // load-error state: visually and semantically distinct from no-results (UX-DR19).
    // v1.7.0 Story 2.2 re-review fix (MEDIUM M2'): pass an explicit segment-level
    // retry action so the recovery path uses `router.refresh()` instead of the
    // DiscoveryEmptyState default `window.location.reload()` (which throws away
    // client cache, hydration state and scroll position).
    return (
      <div className="py-8" data-testid="product-listing-error">
        <DiscoveryEmptyState variant="load-error" action={<ListingRetryButton />} />
      </div>
    );
  }

  const visibleProducts = paginatedProducts;
  const effectiveTotal = totalFiltered;
  const showContextualEditorialCta = categoryPlp && totalFiltered > 0 && totalFiltered < 10;
  const tCategoryPlp = categoryPlp ? await getTranslations('category_plp') : null;
  const contextualCtaLabel = tCategoryPlp?.('editorial_cta') ?? '';

  return (
    <div className="space-y-6 py-2" data-testid="product-listing-container">
      <div className="bb-section-shell bb-section-shell-strong space-y-4">
        <ProductListingHeader total={effectiveTotal} showSort={!categoryPlp} />
        <div className="hidden md:block">
          <ProductListingActiveFilters />
        </div>
      </div>
      <div className={`grid grid-cols-1 gap-6 ${showSidebar ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : ''}`}>
        {showSidebar && (
          categoryPlp ? (
            <CategoryPlpSidebar
              salons={salonOptions}
              cities={sidebarCities}
              locale={locale}
              currencyCode={currencyCode}
            />
          ) : (
            <ProductSidebar
              filters={storefrontFilters}
              categories={categories}
              tags={tags}
              cities={sidebarCities}
            />
          )
        )}
        <section
          className={showSidebar ? 'space-y-6' : 'col-span-full space-y-6'}
          data-testid="product-listing-section"
        >
          {visibleProducts.length === 0 ? (
            <div className="py-6" data-testid="product-listing-empty">
              {categoryPlp ? (
                <CategoryPlpNoResults />
              ) : (
                /* no-results: semantically distinct from load-error/permission-denied (UX-DR19).
                   ClearFiltersButton is the one recommended next action per UX-DR18. */
                <DiscoveryEmptyState
                  variant="no-results"
                  action={<ClearFiltersButton />}
                  data-testid="empty-state"
                />
              )}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${showSidebar ? 'xl:grid-cols-2' : 'xl:grid-cols-3'}`}
              data-testid="product-list"
            >
              <ProductsList products={visibleProducts} fromContext={fromContext} />
            </div>
          )}
          {showContextualEditorialCta && (
            <CategoryPlpContextualCta label={contextualCtaLabel} />
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
