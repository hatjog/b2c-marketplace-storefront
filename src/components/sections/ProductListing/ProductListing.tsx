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

  const parsedMin = rawMin != null ? Number(rawMin) : NaN;
  const parsedMax = rawMax != null ? Number(rawMax) : NaN;

  // city: max length 100, then strip non-allowed chars
  let city: string | undefined;
  if (rawCity && rawCity.length <= 100) {
    const cleaned = rawCity.replace(CITY_ALLOWED_CHARS_RE, '').trim();
    city = cleaned || undefined;
  }

  // duration: must be in allowlist
  let duration: number | undefined;
  if (rawDuration) {
    const parsed = parseInt(rawDuration, 10);
    if (!isNaN(parsed) && (ALLOWED_DURATIONS as readonly number[]).includes(parsed)) {
      duration = parsed;
    }
  }

  // seller_rating: integer in range [1, 5]
  let sellerRating: number | undefined;
  if (rawSellerRating) {
    const parsed = parseInt(rawSellerRating, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      sellerRating = parsed;
    }
  }

  return {
    minPrice: !Number.isNaN(parsedMin) && parsedMin >= 0 ? String(parsedMin) : undefined,
    maxPrice: !Number.isNaN(parsedMax) && parsedMax >= 0 ? String(parsedMax) : undefined,
    tagId: rawTagId && rawTagId.length <= 100 && (UUID_RE.test(rawTagId) || ALPHANUMERIC_RE.test(rawTagId)) ? rawTagId : undefined,
    categoryHandle: rawCategoryHandle && HANDLE_RE.test(rawCategoryHandle) ? rawCategoryHandle : undefined,
    city,
    duration,
    sellerRating
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
  const { categoryHandle, minPrice, maxPrice, tagId, city, duration, sellerRating } = sanitizeSearchParams(searchParams);

  // ADR-046: resolve country code from cookie, not from locale URL segment
  const countryCode = await getCountryCode(locale);
  const t = await getTranslations('filters');

  // Fetch market config for storefront filters
  const marketId = getMarketId();
  const storefrontFilters: StorefrontFilterConfig[] = [];
  let categories: Category[] = [];
  let tags: Tag[] = [];
  let cities: string[] = [];

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
        cities = await listSellerCities();
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
    limit: PRODUCT_LIMIT,
    ...(minPrice ? { min_price: minPrice } : {}),
    ...(maxPrice ? { max_price: maxPrice } : {}),
    ...(tagId ? { tag_id: [tagId] } : {})
  };

  const { response } = await listProductsWithSort({
    seller_id,
    category_id: resolvedCategoryId,
    collection_id,
    countryCode,
    sortBy: 'created_at',
    queryParams,
    city
  });

  let { products } = await response;

  // v1.1.0 client-side filtering for duration and seller_rating.
  // TODO(v1.2.0): move to server-side query once Medusa custom query extensions are ready.
  const clientFiltersActive = duration !== undefined || sellerRating !== undefined;

  if (duration !== undefined) {
    products = products.filter(product =>
      product.variants?.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (variant: any) => Number(variant.metadata?.duration) === duration
      )
    );
  }

  if (sellerRating !== undefined) {
    products = products.filter(product => {
      const avgRating = (product as any).seller?.avg_rating;
      return avgRating !== undefined ? Number(avgRating) >= sellerRating : false;
    });
  }

  const count = products.length;

  const pages = Math.ceil(count / PRODUCT_LIMIT) || 1;

  return (
    <div
      className="py-4"
      data-testid="product-listing-container"
    >
      <ProductListingHeader total={count} />
      <div className="hidden md:block">
        <ProductListingActiveFilters />
      </div>
      {clientFiltersActive && (
        <p className="text-sm text-secondary mt-2 px-1" data-testid="client-filter-hint">
          {t('client_filter_hint')}
        </p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {showSidebar && (
          <ProductSidebar
            filters={storefrontFilters}
            categories={categories}
            tags={tags}
            cities={cities}
          />
        )}
        <section
          className={showSidebar ? 'col-span-3' : 'col-span-4'}
          data-testid="product-listing-section"
        >
          <div
            className="flex flex-wrap gap-4"
            data-testid="product-list"
          >
            <ProductsList products={products} />
          </div>
          {!clientFiltersActive && <ProductsPagination pages={pages} />}
        </section>
      </div>
    </div>
  );
};
