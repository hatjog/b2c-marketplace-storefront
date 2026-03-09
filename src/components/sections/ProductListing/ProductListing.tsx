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
import { listProductsWithSort } from '@/lib/data/products';
import { getMarketId } from '@/lib/helpers/market-filter';
import { resolveMarketConfig } from '@/lib/portal.server';

type Category = { id: string; name: string; handle: string };
type Tag = { id: string; value: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALPHANUMERIC_RE = /^[a-z0-9]+$/i;
const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** Sanitize URL search params to prevent injection / malformed API calls. */
function sanitizeSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const raw = (key: string): string | undefined =>
    typeof searchParams[key] === 'string' ? searchParams[key] : undefined;

  const rawMin = raw('min_price');
  const rawMax = raw('max_price');
  const rawTagId = raw('tag_id');
  const rawCategoryHandle = raw('category_handle');

  const parsedMin = rawMin != null ? Number(rawMin) : NaN;
  const parsedMax = rawMax != null ? Number(rawMax) : NaN;

  return {
    minPrice: !Number.isNaN(parsedMin) && parsedMin >= 0 ? String(parsedMin) : undefined,
    maxPrice: !Number.isNaN(parsedMax) && parsedMax >= 0 ? String(parsedMax) : undefined,
    tagId: rawTagId && (UUID_RE.test(rawTagId) || ALPHANUMERIC_RE.test(rawTagId)) ? rawTagId : undefined,
    categoryHandle: rawCategoryHandle && HANDLE_RE.test(rawCategoryHandle) ? rawCategoryHandle : undefined
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
  const { categoryHandle, minPrice, maxPrice, tagId } = sanitizeSearchParams(searchParams);

  // Fetch market config for storefront filters
  const marketId = getMarketId();
  const storefrontFilters: StorefrontFilterConfig[] = [];
  let categories: Category[] = [];
  const tags: Tag[] = [];
  const cities: string[] = [];

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

      // TODO(v1.2.0): fetch tags from /store/product-tags when tag_group filter is configured
      // TODO(v1.2.0): fetch vendor cities from /store/sellers when location filter is configured
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
    countryCode: locale,
    sortBy: 'created_at',
    queryParams
  });

  const { products } = await response;

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
          <ProductsPagination pages={pages} />
        </section>
      </div>
    </div>
  );
};
