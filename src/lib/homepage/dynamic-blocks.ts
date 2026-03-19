import type { HttpTypes } from '@medusajs/types';

import {
  fetchHomepageBlogPageDocs,
  getPayloadApiUrl,
  mapPayloadPageToBlogPost
} from '@/lib/blog';
import { filterByMarket, filterByMarketOrKeepUntagged, getMarketId } from '@/lib/helpers/market-filter';
import { sortProducts } from '@/lib/helpers/sort-products';
import type { BlogPost } from '@/types/blog';
import type { SortOptions } from '@/types/product';

type HomepageProductsSort = 'newest' | 'price_asc' | 'price_desc';

function getMedusaBackendUrl() {
  return process.env.MEDUSA_BACKEND_URL || 'http://localhost:9002';
}

function buildMedusaUrl(pathname: string) {
  const baseUrl = getMedusaBackendUrl();
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\//, ''), normalizedBase);
}

function getPublishableHeaders() {
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  return {
    'Content-Type': 'application/json',
    ...(publishableKey ? { 'x-publishable-api-key': publishableKey } : {})
  };
}

function mapSortToStorefront(sort: HomepageProductsSort): SortOptions {
  if (sort === 'newest') {
    return 'created_at';
  }

  return sort;
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

  const url = buildMedusaUrl('/store/products');
  url.searchParams.set('country_code', locale);
  url.searchParams.set('limit', String(resolvedLimit));
  url.searchParams.set('fields', '*variants.calculated_price,*variants,*seller');

  const fallbackUrl = buildMedusaUrl('/store/products');
  fallbackUrl.searchParams.set('country_code', locale);
  fallbackUrl.searchParams.set('limit', String(resolvedLimit));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getPublishableHeaders(),
      next: {
        revalidate: 3600,
        tags: ['products']
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
        headers: getPublishableHeaders(),
        next: {
          revalidate: 3600,
          tags: ['products']
        }
      });

      if (fallbackResponse.ok) {
        const fallbackData = (await fallbackResponse.json()) as {
          products?: HttpTypes.StoreProduct[];
        };
        products = Array.isArray(fallbackData.products) ? fallbackData.products : [];
      }
    }

    const marketFiltered = filterByMarketOrKeepUntagged(products, getMarketId());
    const sorted = sortProducts(marketFiltered, resolvedSort);
    return sorted.slice(0, resolvedLimit);
  } catch (error) {
    console.error('[homepage][products] request error', error);
    return [];
  }
}

export async function fetchHomepageCategories({
  limit
}: {
  limit?: number | null;
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
      headers: getPublishableHeaders(),
      next: {
        revalidate: 86400,
        tags: ['categories']
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
    const marketFiltered = filterByMarket(allCategories, getMarketId());
    const rootCategories = marketFiltered.filter(cat => !cat.parent_category_id);
    const mapped = rootCategories
      .map(cat => ({
        name: cat.name,
        handle: cat.handle,
        ...(cat.metadata ? { metadata: cat.metadata as Record<string, any> } : {}),
      }))
      .filter(cat => Boolean(cat.name && cat.handle));

    return mapped.slice(0, resolvedLimit);
  } catch (error) {
    console.error('[homepage][categories] request error', error);
    return [];
  }
}

export async function fetchHomepageBlogPosts({
  limit
}: {
  limit?: number | null;
}): Promise<BlogPost[]> {
  if (!getPayloadApiUrl()) {
    console.error('[homepage][blog] PAYLOAD_API_URL is required');
    return [];
  }

  try {
    const pages = await fetchHomepageBlogPageDocs({
      marketId: getMarketId(),
      limit
    });

    return pages.map(mapPayloadPageToBlogPost);
  } catch (error) {
    console.error('[homepage][blog] request error', error);
    return [];
  }
}
