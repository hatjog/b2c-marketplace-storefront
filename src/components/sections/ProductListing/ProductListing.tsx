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
import { resolveMarketConfig } from '@/lib/portal';

type Category = { id: string; name: string; handle: string };
type Tag = { id: string; value: string };

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
  // Resolve filter params from URL search params
  const categoryHandle = typeof searchParams.category_handle === 'string' ? searchParams.category_handle : undefined;
  const minPrice = typeof searchParams.min_price === 'string' ? searchParams.min_price : undefined;
  const maxPrice = typeof searchParams.max_price === 'string' ? searchParams.max_price : undefined;
  const tagId = typeof searchParams.tag_id === 'string' ? searchParams.tag_id : undefined;

  // Fetch market config for storefront filters
  const marketId = getMarketId();
  const storefrontFilters: StorefrontFilterConfig[] = [];
  let categories: Category[] = [];
  const tags: Tag[] = [];
  const cities: string[] = [];

  if (showSidebar && marketId) {
    try {
      const { marketConfig } = await resolveMarketConfig(marketId);
      const rawFilters = normalizeFilters((marketConfig as Record<string, unknown>)?.storefront_filters);
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

  const queryParams: Record<string, unknown> = { limit: PRODUCT_LIMIT };
  if (minPrice) queryParams.min_price = minPrice;
  if (maxPrice) queryParams.max_price = maxPrice;
  if (tagId) queryParams.tag_id = [tagId];

  const { response } = await listProductsWithSort({
    seller_id,
    category_id: resolvedCategoryId,
    collection_id,
    countryCode: locale,
    sortBy: 'created_at',
    queryParams: queryParams as Parameters<typeof listProductsWithSort>[0]['queryParams']
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
