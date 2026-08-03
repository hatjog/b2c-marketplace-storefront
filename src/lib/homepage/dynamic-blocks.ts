import type { HttpTypes } from '@medusajs/types';

import {
  type BlogCardLabels,
  fetchHomepageBlogPageDocs,
  getPayloadApiUrl,
  mapPayloadPageToBlogPost
} from '@/lib/blog';
import {
  CATEGORIES_CACHE_TAG_SCOPE,
  PRODUCTS_CACHE_TAG_SCOPE
} from '@/lib/data/cache-budgets';
import { buildMedusaUrl } from '@/lib/env';
import { resolveMarketAssetUrl } from '@/lib/helpers/asset-reference';
import { getCountryCode } from '@/lib/helpers/country-code';
import {
  filterByMarket,
  filterByMarketOrKeepUntagged,
  getMarketId
} from '@/lib/helpers/market-filter';
import { sortProducts } from '@/lib/helpers/sort-products';
import { localeCacheTag, withLocaleHeader } from '@/lib/sdk/locale-interceptor';
import type { BlogPost } from '@/types/blog';
import type { SortOptions } from '@/types/product';

type HomepageProductsSort = 'newest' | 'price_asc' | 'price_desc';

function normalizeHomepageProductAssets(
  products: HttpTypes.StoreProduct[],
  marketId: string
): HttpTypes.StoreProduct[] {
  return products.map(product => ({
    ...product,
    thumbnail: resolveMarketAssetUrl(product.thumbnail, marketId) ?? product.thumbnail ?? null,
    images: Array.isArray(product.images)
      ? product.images.flatMap(image => {
          const url = resolveMarketAssetUrl(image?.url, marketId);
          return url ? [{ ...image, url }] : [];
        })
      : product.images
  }));
}

async function getPublishableHeaders() {
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  return withLocaleHeader({
    'Content-Type': 'application/json',
    ...(publishableKey ? { 'x-publishable-api-key': publishableKey } : {})
  });
}

function mapSortToStorefront(sort: HomepageProductsSort): SortOptions {
  if (sort === 'newest') {
    return 'created_at';
  }

  return sort;
}

async function resolveRegionId(countryCode: string): Promise<string | null> {
  try {
    const url = buildMedusaUrl('/store/regions');
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await getPublishableHeaders(),
      next: { revalidate: 3600, tags: [await localeCacheTag('regions')] }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      regions?: Array<{ id: string; countries?: Array<{ iso_2?: string }> }>;
    };
    const region = data.regions?.find(r => r.countries?.some(c => c.iso_2 === countryCode));
    return region?.id ?? null;
  } catch {
    return null;
  }
}

export async function fetchHomepageProducts({
  locale,
  sort,
  limit
}: {
  locale: string;
  sort?: HomepageProductsSort | null;
  limit?: number | null;
}): Promise<HttpTypes.StoreProduct[]> {
  const resolvedLimit = Math.max(1, Math.min(limit ?? 4, 24));
  const resolvedSort = mapSortToStorefront(sort ?? 'newest');

  // Bug v160-tofix-3: locale ('pl', 'en') must be converted to ISO 3166-1 alpha-2
  // country code ('pl', 'gb') before passing to /store/products?country_code=.
  // Passing locale string directly causes 400 for 'en' (no region with country 'en').
  const countryCode = await getCountryCode(locale);
  const regionId = await resolveRegionId(countryCode);

  const url = buildMedusaUrl('/store/products');
  url.searchParams.set('country_code', countryCode);
  if (regionId) url.searchParams.set('region_id', regionId);
  url.searchParams.set('limit', String(resolvedLimit));
  url.searchParams.set(
    'fields',
    'id,title,handle,description,thumbnail,status,+metadata,variants,variants.calculated_price,seller,seller.id,seller.name,seller.handle,seller.status,tags,images'
  );

  const fallbackUrl = buildMedusaUrl('/store/products');
  fallbackUrl.searchParams.set('country_code', countryCode);
  if (regionId) fallbackUrl.searchParams.set('region_id', regionId);
  fallbackUrl.searchParams.set('limit', String(resolvedLimit));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await getPublishableHeaders(),
      next: {
        revalidate: 3600,
        tags: [await localeCacheTag(PRODUCTS_CACHE_TAG_SCOPE)]
      }
    });

    if (!response.ok) {
      console.error(`[homepage][products] fetch failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as {
      products?: HttpTypes.StoreProduct[];
    };

    let products = Array.isArray(data.products) ? data.products : [];

    if (products.length === 0) {
      const fallbackResponse = await fetch(fallbackUrl.toString(), {
        method: 'GET',
        headers: await getPublishableHeaders(),
        next: {
          revalidate: 3600,
          tags: [await localeCacheTag(PRODUCTS_CACHE_TAG_SCOPE)]
        }
      });

      if (fallbackResponse.ok) {
        const fallbackData = (await fallbackResponse.json()) as {
          products?: HttpTypes.StoreProduct[];
        };
        products = Array.isArray(fallbackData.products) ? fallbackData.products : [];
      }
    }

    const marketId = getMarketId();
    const marketFiltered = filterByMarketOrKeepUntagged(products, marketId);
    const sorted = sortProducts(marketFiltered, resolvedSort);
    return normalizeHomepageProductAssets(sorted, marketId).slice(0, resolvedLimit);
  } catch (error) {
    console.error('[homepage][products] request error', error);
    return [];
  }
}

export async function fetchHomepageCategories({
  limit,
  hideEmpty = false
}: {
  limit?: number | null;
  hideEmpty?: boolean;
} = {}): Promise<{ name: string; handle: string; metadata?: Record<string, any> }[]> {
  const resolvedLimit = Math.max(1, Math.min(limit ?? 24, 100));
  const url = buildMedusaUrl('/store/product-categories');

  url.searchParams.set(
    'fields',
    'id,handle,name,rank,metadata,parent_category_id,*category_children'
  );
  url.searchParams.set('include_descendants_tree', 'true');
  url.searchParams.set('include_ancestors_tree', 'true');
  url.searchParams.set('limit', String(resolvedLimit));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await getPublishableHeaders(),
      next: {
        revalidate: 86400,
        tags: [await localeCacheTag(CATEGORIES_CACHE_TAG_SCOPE)]
      }
    });

    if (!response.ok) {
      console.error(
        `[homepage][categories] fetch failed: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = (await response.json()) as {
      product_categories?: HttpTypes.StoreProductCategory[];
    };

    const allCategories = data.product_categories || [];
    const marketId = getMarketId();
    const marketFiltered = filterByMarket(allCategories, marketId);
    const rootCategories = marketFiltered
      .filter(cat => !cat.parent_category_id)
      .filter(
        cat =>
          !hideEmpty || (Array.isArray(cat.category_children) && cat.category_children.length > 0)
      );
    const mapped = rootCategories
      .map(cat => {
        const metadata = cat.metadata ? { ...(cat.metadata as Record<string, any>) } : undefined;
        const resolvedPhotoUrl = resolveMarketAssetUrl(metadata?.photo_url, marketId);

        if (metadata && resolvedPhotoUrl) {
          metadata.photo_url = resolvedPhotoUrl;
        }

        return {
          name: cat.name,
          handle: cat.handle,
          ...(metadata ? { metadata } : {})
        };
      })
      .filter(cat => Boolean(cat.name && cat.handle));

    return mapped.slice(0, resolvedLimit);
  } catch (error) {
    console.error('[homepage][categories] request error', error);
    return [];
  }
}

export async function fetchHomepageBlogPosts({
  locale,
  limit,
  labels
}: {
  /** Route locale — explicit, never inferred inside the fetch (CAP-3/CAP-4). */
  locale: string;
  limit?: number | null;
  labels: BlogCardLabels;
}): Promise<BlogPost[]> {
  if (!getPayloadApiUrl()) {
    console.error('[homepage][blog] PAYLOAD_API_URL is required');
    return [];
  }

  try {
    const pages = await fetchHomepageBlogPageDocs({
      marketId: getMarketId(),
      locale,
      limit
    });

    return pages.map((page, index) => mapPayloadPageToBlogPost(page, index, labels));
  } catch (error) {
    console.error('[homepage][blog] request error', error);
    return [];
  }
}
