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
import { listCategories } from '@/lib/data/categories';
import { listProductsWithSort, listProductTags, listSellerCities } from '@/lib/data/products';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { resolveMarketConfig } from '@/lib/portal.server';
import { getTranslations } from 'next-intl/server';
import { ClearFiltersButton } from './ClearFiltersButton';

type Category = { id: string; name: string; handle: string };
type Tag = { id: string; value: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALPHANUMERIC_RE = /^[a-z0-9]+$/i;
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

  // tagIds: split by comma, validate each as UUID or alphanumeric
  const tagIds: string[] = rawTagId
    ? rawTagId
        .split(',')
        .map(s => s.trim())
        .filter(id => Boolean(id) && (UUID_RE.test(id) || ALPHANUMERIC_RE.test(id)))
    : [];

  // page: integer [1, 999]
  const page = rawPage ? Math.max(1, Math.min(999, parseInt(rawPage, 10) || 1)) : 1;

  return {
    minPrice: !Number.isNaN(parsedMin) && parsedMin >= 0 ? String(parsedMin) : undefined,
    maxPrice: !Number.isNaN(parsedMax) && parsedMax >= 0 ? String(parsedMax) : undefined,
    tagIds,
    categoryHandle: rawCategoryHandle && HANDLE_RE.test(rawCategoryHandle) ? rawCategoryHandle : undefined,
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
  searchParams = {}
}: {
  category_id?: string;
  collection_id?: string;
  seller_id?: string;
  showSidebar?: boolean;
  locale?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) => {
  // Resolve & sanitize filter params from URL search params
  const { categoryHandle, minPrice, maxPrice, tagIds, cities, durations, sellerRatings, page } = sanitizeSearchParams(searchParams);

  // ADR-046: resolve country code from cookie, not from locale URL segment
  const countryCode = await getCountryCode(locale);
  const t = await getTranslations('filters');

  // Fetch market config for storefront filters
  const marketId = getMarketId();
  const storefrontFilters: StorefrontFilterConfig[] = [];
  let categories: Category[] = [];
  let tags: Tag[] = [];
  let sidebarCities: string[] = [];

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
    } catch {
      // Sidebar filters not critical — listing still works without them
    }
  }

  // Resolve category_id from URL handle if provided
  let resolvedCategoryId = category_id;
  if (categoryHandle && categories.length > 0) {
    const matched = categories.find(c => c.handle === categoryHandle);
    if (matched) resolvedCategoryId = matched.id;
  }

  const queryParams: HttpTypes.FindParams & HttpTypes.StoreProductParams = {
    ...(minPrice ? { min_price: minPrice } : {}),
    ...(maxPrice ? { max_price: maxPrice } : {}),
    ...(tagIds.length > 0 ? { tag_id: tagIds } : {})
  };

  const { response } = await listProductsWithSort({
    seller_id,
    category_id: resolvedCategoryId,
    collection_id,
    countryCode,
    sortBy: 'created_at',
    queryParams,
    cities
  });

  // v1.1.0 client-side filtering for duration and seller_rating.
  // listProductsWithSort returns ALL products; we filter and slice here.
  // TODO(v1.2.0): move to server-side query once Medusa custom query extensions are ready.
  let filteredProducts = response.products;

  if (durations.length > 0) {
    filteredProducts = filteredProducts.filter(product =>
      product.variants?.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (variant: any) => durations.includes(Number(variant.metadata?.duration))
      )
    );
  }

  if (sellerRatings.length > 0) {
    filteredProducts = filteredProducts.filter(product => {
      const avgRating = (product as any).seller?.avg_rating;
      return avgRating !== undefined ? sellerRatings.some(r => Number(avgRating) >= r) : false;
    });
  }

  const totalFiltered = filteredProducts.length;
  const pages = Math.ceil(totalFiltered / PRODUCT_LIMIT);
  const offset = (page - 1) * PRODUCT_LIMIT;
  const paginatedProducts = filteredProducts.slice(offset, offset + PRODUCT_LIMIT);

  return (
    <div
      className="py-4"
      data-testid="product-listing-container"
    >
      <ProductListingHeader total={totalFiltered} />
      <div className="hidden md:block">
        <ProductListingActiveFilters />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {showSidebar && (
          <ProductSidebar
            filters={storefrontFilters}
            categories={categories}
            tags={tags}
            cities={sidebarCities}
          />
        )}
        <section
          className={showSidebar ? 'col-span-3' : 'col-span-4'}
          data-testid="product-listing-section"
        >
          {paginatedProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12" data-testid="empty-state">
              <p>{t('no_results')}</p>
              <ClearFiltersButton />
            </div>
          ) : (
            <div
              className="flex flex-wrap gap-4"
              data-testid="product-list"
            >
              <ProductsList products={paginatedProducts} />
            </div>
          )}
          {pages > 1 && <ProductsPagination pages={pages} />}
        </section>
      </div>
    </div>
  );
};
