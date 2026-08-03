'use server';

import * as Sentry from '@sentry/nextjs';
import type { HttpTypes } from '@medusajs/types';

import { resolveContentBarGateSlug } from '@/lib/content-gate';
import type { ListedProduct } from '@/lib/helpers/normalize-listed-products';
import { normalizeListedProducts } from '@/lib/helpers/normalize-listed-products';
import { hasCustomFilters } from '@/lib/helpers/has-custom-filters';
import { applyCategoryPlpSemanticFilters } from '@/lib/helpers/category-plp-semantic-filters';
import type { SelfPurchaseMode } from '@/lib/helpers/parse-purchase-mode';
import { sortProducts } from '@/lib/helpers/sort-products';
import { sortByRecommended } from '@/lib/helpers/sort-utils';
import type { SortOptions } from '@/types/product';

import type { StorefrontLocaleSlug } from '@/lib/sdk/locale-interceptor';
import {
  resolveStorefrontLocaleSlug,
  withLocaleHeaderForSlug
} from '@/lib/sdk/locale-interceptor';

import { sdk } from '../config';
import { PRODUCTS_CACHE_REVALIDATE_SECONDS, PRODUCTS_CACHE_TAG_SCOPE } from './cache-budgets';
import { getAuthHeaders } from './cookies';
import { retrieveCustomer } from './customer';
import { createLocaleKeyedCache } from './locale-cache';
import { paginateSortedProducts } from './products-pagination';
import { getRegion, retrieveRegion } from './regions';

export type ProductQueryParams = HttpTypes.FindParams &
  HttpTypes.StoreProductParams & {
    handle?: string[];
    min_price?: string;
    max_price?: string;
  };

type CatalogPage = {
  products: ListedProduct[];
  count: number;
};

/**
 * Wszystko, co wpływa na treść odpowiedzi backendu dla listingu katalogu.
 * Ten obiekt jest argumentem funkcji cache'owanej ⇒ CZĘŚCIĄ KLUCZA. Pominięcie
 * któregokolwiek pola dałoby przeciek MIĘDZY ZAPYTANIAMI (np. strona 2 podana
 * jako strona 1), a nie tylko między locale.
 */
type CatalogQueryKey = {
  countryCode?: string;
  regionId: string;
  category_id?: string | string[];
  collection_id?: string;
  limit: number;
  offset: number;
  fields: string;
  queryParams?: ProductQueryParams;
};

async function fetchCatalogPage(
  locale: StorefrontLocaleSlug,
  key: CatalogQueryKey,
  extraHeaders: Record<string, string>
): Promise<CatalogPage> {
  return sdk.client.fetch<CatalogPage>(`/store/products`, {
    method: 'GET',
    query: {
      country_code: key.countryCode,
      category_id: key.category_id,
      collection_id: key.collection_id,
      limit: key.limit,
      offset: key.offset,
      fields: key.fields,
      ...key.queryParams,
      region_id: key.regionId,
    },
    // AC2: locale JAWNIE z argumentu — również na torze nie-cache'owanym,
    // żeby obie ścieżki miały identyczną semantykę lokalizacji.
    headers: withLocaleHeaderForSlug(extraHeaders, locale)
  });
}

/**
 * v1.14.0 Story 1.2 (AD-1, AC1/AC2/AC5) — locale-keyed Data Cache listingu katalogu.
 *
 * Cache'owany jest WYŁĄCZNIE anonimowy, surowy odczyt: brak nagłówka
 * `authorization`, brak normalizacji zależnej od `preferredSellerId`.
 * Uzasadnienie w `listProducts` przy `authHeaders`.
 *
 * Błędy propagują się celowo — `unstable_cache` nie zapisuje odrzuconej
 * obietnicy, więc awaria backendu nie zamraża pustego katalogu na 300 s.
 */
const fetchCatalogPageCached = createLocaleKeyedCache({
  keyPrefix: 'storefront-list-products',
  tagScope: PRODUCTS_CACHE_TAG_SCOPE,
  revalidate: PRODUCTS_CACHE_REVALIDATE_SECONDS,
  fetcher: (locale: StorefrontLocaleSlug, key: CatalogQueryKey): Promise<CatalogPage> =>
    fetchCatalogPage(locale, key, {})
});

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
  category_id,
  collection_id,
  includeSellerContext = false,
  preferredSellerId,
  locale,
}: {
  pageParam?: number;
  queryParams?: ProductQueryParams;
  category_id?: string | string[];
  collection_id?: string;
  countryCode?: string;
  regionId?: string;
  includeSellerContext?: boolean;
  preferredSellerId?: string;
  /**
   * Slug locale z route'u. Pominięcie jest legalne TYLKO tutaj (poza cache
   * scope) — wtedy locale jest auto-resolvowane PRZED wejściem do cache.
   */
  locale?: StorefrontLocaleSlug;
}): Promise<{
  response: {
    products: ListedProduct[];
    /**
     * Post-filter count for the current page's rendered batch.
     * Use this for UI pagination labels ("X listings on this page").
     */
    count: number;
    /**
     * Pre-filter backend count (total products across all pages).
     * Use this for fetch-all logic in listProductsWithSort.
     */
    backendCount?: number;
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

  // PUŁAPKA (Story 1.2, AC2/AC5): `getAuthHeaders()` czyta cookie `_medusa_jwt`.
  // Wywołanie go WEWNĄTRZ `unstable_cache` byłoby błędem runtime (brak
  // `cookies()` w cache scope), a wrzucenie tokenu do współdzielonego wpisu
  // dałoby przeciek danych sesji MIĘDZY KLIENTKAMI — groźniejszy niż przeciek
  // locale. Dlatego token czytamy TUTAJ, przed wrapperem, i rozcinamy tory:
  //   - anonimowy odczyt  → współdzielony, locale-keyed `unstable_cache`;
  //   - wariant z `authorization` → bezpośredni fetch, BEZ wspólnego wpisu.
  const authHeaders = (await getAuthHeaders()) as Record<string, string>;
  const isAuthenticatedRead = typeof authHeaders.authorization === 'string';

  // AD-1: locale rozwiązane PRZED wejściem do cache, nigdy w callbacku.
  const resolvedLocale = locale ?? (await resolveStorefrontLocaleSlug());

  // AD-4 (Story 1.4): slug baru dla `checkQualityGate` rozstrzygany TUTAJ —
  // odczyt flagi FAZY 2 wymaga fs/runtime configu, więc nie może się zdarzyć
  // w czystym helperze normalizatora ani w cache scope. FAZA 1 ⇒ 'pl'.
  const gateSlug = await resolveContentBarGateSlug(resolvedLocale);

  const fields = [
    'id',
    'title',
    'handle',
    'description',
    // Story 1.3 (AC1): subtitle wchodzi do fields, żeby overlay Translation
    // Module mógł go lokalizować. resolveProductCatalogDisplayFields już
    // preferuje natywny product.subtitle nad metadata.gp.subtitle (fallback).
    'subtitle',
    'thumbnail',
    'status',
    'variants.calculated_price',
    'seller',
    'seller.id',
    'seller.name',
    'seller.handle',
    'seller.status',
    'variants',
    ...(includeSellerContext
      ? [
          'seller.products',
          // '*seller.reviews' — causes backend 500 (Mercur 2 SellerReview expansion
          // not supported on /store/products; reviews fetched separately on seller page).
          'seller.products.variants',
        ]
      : []),
    'attribute_values',
    'attribute_values.attribute',
    'tags',
    'images',
    '+metadata',
  ].join(',');

  const queryKey: CatalogQueryKey = {
    countryCode,
    regionId: region.id,
    category_id,
    collection_id,
    limit,
    offset,
    fields,
    queryParams,
  };

  const catalogPage = isAuthenticatedRead
    ? fetchCatalogPage(resolvedLocale, queryKey, authHeaders)
    : fetchCatalogPageCached(resolvedLocale, queryKey);

  return catalogPage
    .then(({ products: productsRaw, count: backendCount }) => {
      // Apply quality-gate filter BEFORE exposing pagination signals to UI.
      // Backend `count` is pre-filter; using it for the rendered listing causes
      // pagination drift ("12 listings shown but only 9 rendered") —
      // see deferred-work.md (v1.4.0).
      //
      // Rule: filter step (normalizeListedProducts) THEN pagination logic.
      // - `filteredCount` = post-filter length, authoritative for UI rendering
      //   of THIS page's batch.
      // - `count` = same value as `filteredCount` for backwards-compat callers
      //   of listProducts() that render the page directly.
      // - `backendCount` = pre-filter total, exposed for fetch-all consumers
      //   like listProductsWithSort() which need to know how many pages exist
      //   server-side before client-side filtering trims the batch.
      const products = normalizeListedProducts(productsRaw, preferredSellerId, { gateSlug });
      const filteredCount = products.length;

      // nextPage uses backendCount because the iterator advances over backend
      // pagination — additional filtered pages may exist server-side.
      const nextPage = backendCount > offset + limit ? pageParam + 1 : null;

      return {
        response: {
          products,
          count: filteredCount,
          backendCount
        },
        nextPage: nextPage,
        queryParams
      };
    })
    .catch((error) => {
      console.error('[products] listProducts failed:', error?.message || error);
      // v1.14.0 Story 1.2 (review-fix 1-2-F6): ten `catch` łapie teraz również
      // awarie kontraktu cache scope (`cookies()`/`headers()` w callbacku
      // `unstable_cache`, błąd serializacji argumentu, brak incremental cache),
      // które objawiają się identycznie jak backend 503: WYZEROWANY KATALOG dla
      // ruchu anonimowego, przy działającym torze auth. Bez raportu do Sentry
      // jedynym śladem byłby log stdout — a ten plik raportuje przez Sentry
      // zdarzenia o rząd wielkości mniej krytyczne (`product count exceeds 1000`).
      Sentry.captureException(error, {
        tags: { scope: 'listProducts', layer: 'data-cache' }
      });
      return {
        response: {
          products: [],
          count: 0,
          backendCount: 0
        },
        nextPage: null,
        queryParams
      };
    });
};

const FETCH_LIMIT = 100;
const PRODUCT_HARD_CAP = 1000;

type SearchProductsResponse = {
  products: ListedProduct[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  facets: Record<string, any>;
  processingTimeMS: number;
};

async function fetchSearchProductsPage({
  body,
  headers,
}: {
  body: Record<string, unknown>;
  headers: Record<string, string>;
}): Promise<SearchProductsResponse> {
  return sdk.client.fetch<SearchProductsResponse>(`/store/products/search`, {
    method: 'POST',
    body,
    headers,
    cache: 'no-cache'
  });
}

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
      if (sellerRatings?.length) {
        return {
          response: { products: [], count: 0 },
          nextPage: null,
          queryParams: undefined,
        };
      }
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
  semanticFilters,
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
  semanticFilters?: {
    sellerHandle?: string;
    availability?: 'in_stock';
    purchaseMode?: SelfPurchaseMode;
  };
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
  const hasSemanticFilters = Boolean(
    semanticFilters?.sellerHandle ||
      semanticFilters?.availability === 'in_stock' ||
      semanticFilters?.purchaseMode
  );

  // Pipeline mode: any custom filter active AND no seller_id scope → backend pipeline.
  // seller_id is not supported in the pipeline endpoint — fall through to native mode when set.
  // Category-PLP semantic filters are currently evaluated in storefront data layer,
  // therefore pipeline is bypassed when those filters are active.
  if (
    !seller_id &&
    !hasSemanticFilters &&
    hasCustomFilters({ tagIds, cities, durations, sellerRatings })
  ) {
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

  // Use the pre-filter `backendCount` for fetch-all bookkeeping; falls back to
  // `count` for legacy callers (and offline test mocks) that don't expose
  // backendCount. Inside listProducts() count == filteredCount; backendCount
  // is the authoritative pre-filter total.
  const backendCount = firstResult.response.backendCount ?? firstResult.response.count;

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

  const semanticFiltered = applyCategoryPlpSemanticFilters(filteredBySeller, semanticFilters);

  const pricedProducts = semanticFiltered.filter(prod =>
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
  products: ListedProduct[];
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

  // AD-4 (Story 1.4): search dziedziczy TEN SAM gate co listing — bez tego
  // FAZA 2 dla locale obowiązywałaby na `/categories`, a nie na wyszukiwarce.
  const searchGateSlug = await resolveContentBarGateSlug(await resolveStorefrontLocaleSlug());

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
  const requestedPage = Math.max(0, params.page || 0);
  const requestedHitsPerPage = Math.max(1, params.hitsPerPage || 12);
  const baseBody: Record<string, unknown> = {
    ...bodyParams,
    ...(currency_code ? { currency_code } : {}),
    region_id,
    customer_id,
    facets,
    maxValuesPerFacet: 100
  };

  return fetchSearchProductsPage({
    body: {
      ...baseBody,
      page: 0,
      hitsPerPage: FETCH_LIMIT,
    },
    headers,
  })
    .then(async (firstPage) => {
      if (firstPage.nbHits > 500) {
        console.warn('[GP] Search product count exceeds 500, consider Algolia migration');
      }

      if (firstPage.nbHits > PRODUCT_HARD_CAP) {
        Sentry.captureMessage('[GP] Search product count exceeds 1000, hard cap applied', 'error');
      }

      const cappedHits = Math.min(firstPage.nbHits, PRODUCT_HARD_CAP);
      let allProducts = [...firstPage.products];

      if (cappedHits > FETCH_LIMIT) {
        const totalPages = Math.ceil(cappedHits / FETCH_LIMIT);
        const remainingPageNums = Array.from({ length: totalPages - 1 }, (_, index) => index + 1);
        const results = await Promise.allSettled(
          remainingPageNums.map((pageNum) =>
            fetchSearchProductsPage({
              body: {
                ...baseBody,
                page: pageNum,
                hitsPerPage: FETCH_LIMIT,
              },
              headers,
            })
          )
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            allProducts.push(...result.value.products);
          } else {
            console.error('[products] searchProducts parallel fetch failed:', result.reason);
          }
        }
      }

      const normalizedProducts = normalizeListedProducts(allProducts, undefined, {
        gateSlug: searchGateSlug
      });
      const exactNbHits = normalizedProducts.length;
      const start = requestedPage * requestedHitsPerPage;
      const end = start + requestedHitsPerPage;

      return {
        ...firstPage,
        products: normalizedProducts.slice(start, end),
        nbHits: exactNbHits,
        nbPages: Math.max(1, Math.ceil(exactNbHits / requestedHitsPerPage)),
        page: requestedPage,
        hitsPerPage: requestedHitsPerPage,
      };
    })
    .catch((error) => {
      console.error('[products] searchProducts failed:', error?.message || error);
      return {
        products: [],
        nbHits: 0,
        page: requestedPage,
        nbPages: 0,
        hitsPerPage: requestedHitsPerPage,
        facets: {},
        processingTimeMS: 0
      };
    });
};
