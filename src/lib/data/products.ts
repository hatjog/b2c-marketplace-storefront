'use server';

import * as Sentry from '@sentry/nextjs';
import type { HttpTypes } from '@medusajs/types';

import type { ListedProduct } from '@/lib/helpers/normalize-listed-products';
import { normalizeListedProducts } from '@/lib/helpers/normalize-listed-products';
import { hasCustomFilters } from '@/lib/helpers/has-custom-filters';
import { sortProducts } from '@/lib/helpers/sort-products';
import { sortByRecommended } from '@/lib/helpers/sort-utils';
import type { SortOptions } from '@/types/product';
import type { SellerProps } from '@/types/seller';

import { sdk } from '../config';
import { getAuthHeaders } from './cookies';
import { retrieveCustomer } from './customer';
import { paginateSortedProducts } from './products-pagination';
import { getRegion, retrieveRegion } from './regions';

export type ProductQueryParams = HttpTypes.FindParams &
  HttpTypes.StoreProductParams & {
    handle?: string[];
    min_price?: string;
    max_price?: string;
  };

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
  category_id,
  collection_id,
  forceCache = false,
  includeSellerContext = false,
  preferredSellerId,
}: {
  pageParam?: number;
  queryParams?: ProductQueryParams;
  category_id?: string | string[];
  collection_id?: string;
  countryCode?: string;
  regionId?: string;
  forceCache?: boolean;
  includeSellerContext?: boolean;
  preferredSellerId?: string;
}): Promise<{
  response: {
    products: ListedProduct[];
    count: number;
  };
  nextPage: number | null;
  queryParams?: ProductQueryParams;
}> => {
  if (!countryCode && !regionId) {
    throw new Error('Country code or region ID is required');
  }

  const limit = queryParams?.limit || 12;
  const _pageParam = Math.max(pageParam, 1);
  const offset = (_pageParam - 1) * limit;

  let region: HttpTypes.StoreRegion | undefined | null;

  if (countryCode) {
    region = await getRegion(countryCode);
  } else {
    region = await retrieveRegion(regionId!);
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null
    };
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  const fields = [
    '*variants.calculated_price',
    '+variants.inventory_quantity',
    '*seller',
    '*variants',
    ...(includeSellerContext
      ? [
          '*seller.products',
          '*seller.reviews',
          '*seller.reviews.customer',
          '*seller.reviews.seller',
          '*seller.products.variants',
        ]
      : []),
    '*attribute_values',
    '*attribute_values.attribute',
    '*tags',
    '*images',
    '+metadata',
  ].join(',');

  const useCached = forceCache || (limit <= 8 && !category_id && !collection_id);

  return sdk.client
    .fetch<{
      products: ListedProduct[];
      count: number;
    }>(`/store/products`, {
      method: 'GET',
      query: {
        country_code: countryCode,
        category_id,
        collection_id,
        limit,
        offset,
        fields,
        ...queryParams,
        region_id: region.id,
      },
      headers,
      next: useCached ? { revalidate: 60 } : undefined,
      cache: useCached ? 'force-cache' : 'no-cache'
    })
    .then(({ products: productsRaw, count }) => {
      const products = normalizeListedProducts(productsRaw, preferredSellerId);

      const nextPage = count > offset + limit ? pageParam + 1 : null;

      return {
        response: {
          products,
          count
        },
        nextPage: nextPage,
        queryParams
      };
    })
    .catch((error) => {
      console.error('[products] listProducts failed:', error?.message || error);
      return {
        response: {
          products: [],
          count: 0
        },
        nextPage: null,
        queryParams
      };
    });
};

const FETCH_LIMIT = 100;
const PRODUCT_HARD_CAP = 1000;

/**
 * Fetches from the custom pipeline endpoint GET /store/products/filtered.
 * Called by listProductsWithSort() when hasCustomFilters() returns true.
 *
 * Products are already server-side paginated — no client-side slicing needed.
 * The returned count is the total matching count for pagination UI.
 *
 * ERROR POLICY: Throws on fetch error (no fallback to native Medusa).
 * Fallback would produce inconsistent counts and mask pipeline issues.
 */
export const listFilteredProducts = async ({
  tagIds,
  categoryId,
  cities,
  durations,
  sellerRatings,
  minPrice,
  maxPrice,
  page = 1,
  limit,
  sortBy,
  countryCode,
}: {
  tagIds?: string[];
  categoryId?: string | string[];
  cities?: string[];
  durations?: number[];
  sellerRatings?: number[];
  minPrice?: string;
  maxPrice?: string;
  page?: number;
  limit?: number;
  sortBy?: SortOptions;
  countryCode: string;
}): Promise<{
  response: {
    products: HttpTypes.StoreProduct[];
    count: number;
  };
  nextPage: null;
  queryParams?: ProductQueryParams;
}> => {
  const region = await getRegion(countryCode);
  const currencyCode = region?.currency_code ?? undefined;

  const effectiveLimit = limit ?? 12;
  // page is 1-indexed from the URL (?page=2); backend accepts 0-indexed offset
  const offset = (Math.max(page, 1) - 1) * effectiveLimit;

  const params: Record<string, string> = {
    offset: String(offset),
    limit: String(effectiveLimit),
  };

  if (tagIds?.length) params.tag_id = tagIds.join(',');
  if (categoryId) params.category_id = Array.isArray(categoryId) ? categoryId.join(',') : categoryId;
  if (cities?.length) params.city = cities.join(',');
  if (durations?.length) params.duration = durations.join(',');
  if (sellerRatings?.length) params.seller_rating = sellerRatings.join(',');
  if (minPrice) params.min_price = minPrice;
  if (maxPrice) params.max_price = maxPrice;
  if (sortBy && sortBy !== 'recommended') params.order = sortBy;
  if (region?.id) params.region_id = region.id;
  if (currencyCode) params.currency_code = currencyCode;

  const headers = {
    ...(await getAuthHeaders())
  };

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number; offset: number; limit: number }>(
      `/store/products/filtered`,
      {
        method: 'GET',
        query: params,
        headers,
        cache: 'no-cache',
      }
    )
    .then(({ products, count }) => ({
      response: { products, count },
      nextPage: null,
      queryParams: undefined,
    }))
    .catch((error) => {
      console.error(
        '[products] listFilteredProducts failed:',
        error?.message || error,
        { params }
      );
      // Re-throw: no silent fallback to Medusa native (would give inconsistent counts)
      throw error;
    });
};

/**
 * Fetches ALL products (paginated fetch-all, hard cap 1000), applies city filter and sort,
 * and returns the correct paginated page in native mode when `limit` is provided.
 *
 * When custom filters (tag_id, city, duration, seller_rating) are active, delegates to
 * listFilteredProducts() for server-side filtering and pagination via the pipeline endpoint.
 */
export const listProductsWithSort = async ({
  queryParams,
  sortBy = 'recommended',
  countryCode,
  category_id,
  seller_id,
  collection_id,
  cities,
  tagIds,
  durations,
  sellerRatings,
  page,
  limit,
}: {
  queryParams?: ProductQueryParams;
  sortBy?: SortOptions;
  countryCode: string;
  category_id?: string | string[];
  seller_id?: string;
  collection_id?: string;
  cities?: string[];
  tagIds?: string[];
  durations?: number[];
  sellerRatings?: number[];
  page?: number;
  limit?: number;
}): Promise<{
  response: {
    products: HttpTypes.StoreProduct[];
    count: number;
  };
  nextPage: number | null;
  queryParams?: ProductQueryParams;
}> => {
  // Pipeline mode: any custom filter active AND no seller_id scope → backend pipeline.
  // seller_id is not supported in the pipeline endpoint — fall through to native mode when set.
  if (!seller_id && hasCustomFilters({ tagIds, cities, durations, sellerRatings })) {
    return listFilteredProducts({
      tagIds,
      categoryId: category_id,
      cities,
      durations,
      sellerRatings,
      minPrice: queryParams?.min_price as string | undefined,
      maxPrice: queryParams?.max_price as string | undefined,
      page,
      limit,
      sortBy,
      countryCode,
    });
  }

  // Native mode: Medusa default path — fetch-all + client-side filtering
  // First fetch to discover total count
  const firstResult = await listProducts({
    pageParam: 1,
    queryParams: { ...queryParams, limit: FETCH_LIMIT },
    category_id,
    collection_id,
    countryCode,
    preferredSellerId: seller_id,
  });

  const backendCount = firstResult.response.count;

  if (backendCount > 500) {
    console.warn('[GP] Product count exceeds 500, consider Algolia migration');
  }

  if (backendCount > PRODUCT_HARD_CAP) {
    Sentry.captureMessage('[GP] Product count exceeds 1000, hard cap applied', 'error');
  }

  const cappedCount = Math.min(backendCount, PRODUCT_HARD_CAP);
  let allProducts = [...firstResult.response.products];

  // Fetch remaining pages in parallel
  if (cappedCount > FETCH_LIMIT) {
    const totalPages = Math.ceil(cappedCount / FETCH_LIMIT);
    const remainingPageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

    const results = await Promise.allSettled(
      remainingPageNums.map(pageNum =>
        listProducts({
          pageParam: pageNum,
          queryParams: { ...queryParams, limit: FETCH_LIMIT },
          category_id,
          collection_id,
          countryCode,
          preferredSellerId: seller_id,
        })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allProducts.push(...result.value.response.products);
      } else {
        console.error('[products] listProductsWithSort parallel fetch failed:', result.reason);
      }
    }
  }

  // Deduplicate by product.id (guards against race condition between fetches)
  const deduped = Array.from(new Map(allProducts.map(p => [p.id, p])).values());

  // Filter by seller_id if provided (e.g. seller storefront page)
  const filteredBySeller = seller_id
    ? deduped.filter(product => (product as any).seller?.id === seller_id)
    : deduped;

  const pricedProducts = filteredBySeller.filter(prod =>
    prod.variants?.some(variant => variant.calculated_price !== null)
  );

  const sortedProducts = sortBy === 'recommended'
    ? sortByRecommended(pricedProducts)
    : sortProducts(pricedProducts, sortBy);

  const paginatedProducts = paginateSortedProducts(sortedProducts, page, limit);

  return {
    response: {
      products: paginatedProducts.products,
      count: sortedProducts.length
    },
    nextPage: paginatedProducts.nextPage,
    queryParams
  };
};

/**
 * Fetches product tags scoped to the current sales channel.
 * Optional `tagGroup` parameter forwards to backend prefix filtering.
 */
export const listProductTags = async (tagGroup?: string): Promise<Array<{ id: string; value: string; label: string }>> => {
  return sdk.client
    .fetch<{ tags: Array<{ id: string; value: string; label: string }> }>(
      `/store/gp-product-tags`,
      {
        method: 'GET',
        query: tagGroup ? { tag_group: tagGroup } : undefined,
        cache: 'no-cache'
      }
    )
    .then(({ tags }) => tags ?? [])
    .catch((error) => {
      console.error('[products] listProductTags failed:', error?.message || error);
      return [];
    });
};

/**
 * Fetches distinct seller cities scoped to the current sales channel.
 * Used by LocationFilter to populate city dropdown options.
 */
export const listSellerCities = async (): Promise<string[]> => {
  return sdk.client
    .fetch<{ cities: string[] }>(
      `/store/sellers/cities`,
      {
        method: 'GET',
        cache: 'no-cache'
      }
    )
    .then(({ cities }) => cities ?? [])
    .catch((error) => {
      console.error('[products] listSellerCities failed:', error?.message || error);
      return [];
    });
};

export const searchProducts = async (params: {
  query?: string;
  page?: number;
  hitsPerPage?: number;
  filters?: string;
  facets?: string[];
  maxValuesPerFacet?: number;
  currency_code?: string;
  countryCode?: string;
  region_id?: string;
  customer_id?: string;
  customer_group_id?: string[];
}): Promise<{
  products: (HttpTypes.StoreProduct & { seller?: SellerProps })[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  facets: Record<string, any>;
  processingTimeMS: number;
}> => {
  if (!params.countryCode && !params.region_id) {
    throw new Error('Country code or region ID is required');
  }

  let region_id = params.region_id;
  let currency_code = params.currency_code;

  if ((!region_id || !currency_code) && params.countryCode) {
    const region = await getRegion(params.countryCode);
    if (!region) {
      throw new Error(`Region not found for country code: ${params.countryCode}`);
    }
    region_id = region.id;
    currency_code = currency_code ?? region.currency_code ?? undefined;
  } else if (!currency_code && region_id) {
    const region = await retrieveRegion(region_id);
    currency_code = region.currency_code ?? undefined;
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  let customer_id = params.customer_id;

  if (!customer_id) {
    const customer = await retrieveCustomer();
    if (customer) {
      customer_id = customer.id;
    }
  }

  let facets = params.facets;

  if (!facets) {
    facets = ['variants.condition', 'variants.color', 'variants.size'];
  }

  const { countryCode: _countryCode, ...bodyParams } = params;

  return sdk.client
    .fetch<{
      products: (HttpTypes.StoreProduct & { seller?: SellerProps })[];
      nbHits: number;
      page: number;
      nbPages: number;
      hitsPerPage: number;
      facets: Record<string, any>;
      processingTimeMS: number;
    }>(`/store/products/search`, {
      method: 'POST',
      body: {
        ...bodyParams,
        ...(currency_code ? { currency_code } : {}),
        region_id,
        customer_id,
        facets,
        maxValuesPerFacet: 100
      },
      headers,
      cache: 'no-cache'
    })
    .then((result) => ({
      ...result,
      products: normalizeListedProducts(result.products),
    }))
    .catch((error) => {
      console.error('[products] searchProducts failed:', error?.message || error);
      return {
        products: [],
        nbHits: 0,
        page: params.page || 0,
        nbPages: 0,
        hitsPerPage: params.hitsPerPage || 12,
        facets: {},
        processingTimeMS: 0
      };
    });
};
