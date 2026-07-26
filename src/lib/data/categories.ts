import type { HttpTypes } from '@medusajs/types';

import { sdk } from '@/lib/config';
import { filterByMarket, getMarketId } from '@/lib/helpers/market-filter';
import type { StorefrontLocaleSlug } from '@/lib/sdk/locale-interceptor';
import { resolveStorefrontLocaleSlug, withLocaleHeaderForSlug } from '@/lib/sdk/locale-interceptor';

import {
  CATEGORIES_CACHE_REVALIDATE_SECONDS,
  CATEGORIES_CACHE_TAG_SCOPE
} from './cache-budgets';
import { createLocaleKeyedCache } from './locale-cache';

interface CategoriesProps {
  query?: Record<string, unknown>;
}

const CATEGORY_FIELDS =
  'id,handle,name,rank,metadata,parent_category_id,description,*category_children';

/**
 * v1.14.0 Story 1.2 (AD-1) — locale-keyed Data Cache zamiast `cache: 'no-store'`.
 *
 * Poprzedni stan (v1.12.0 UA-loc): wspólny `force-cache` na tym samym URL
 * przeciekał pierwszy pobrany locale na wszystkie, bo klucz Next Data Cache NIE
 * wlicza nagłówków żądania. Obejściem był `no-store` — poprawny, ale zerował
 * wydajność. Teraz locale jest JAWNYM ARGUMENTEM funkcji owiniętej
 * `unstable_cache`, więc waryjuje klucz strukturalnie. Powrót do
 * `force-cache` + nagłówek jest zakazany (AD-1) i pilnowany testem.
 *
 * Cache'owany jest SUROWY odczyt z backendu. Filtrowanie market-scope
 * (`filterByMarket`) zostaje NA ZEWNĄTRZ wpisu — patrz nota o `getMarketId()`
 * przy `listCategories`.
 */
const fetchCategoriesCached = createLocaleKeyedCache({
  keyPrefix: 'storefront-list-categories',
  tagScope: CATEGORIES_CACHE_TAG_SCOPE,
  revalidate: CATEGORIES_CACHE_REVALIDATE_SECONDS,
  fetcher: async (
    locale: StorefrontLocaleSlug,
    query: Record<string, unknown>
  ): Promise<HttpTypes.StoreProductCategory[]> => {
    const { product_categories } = await sdk.client.fetch<{
      product_categories: HttpTypes.StoreProductCategory[];
    }>('/store/product-categories', {
      query: {
        fields: CATEGORY_FIELDS,
        include_descendants_tree: true,
        include_ancestors_tree: true,
        ...query
      },
      // AC2: locale wstrzyknięte JAWNIE z argumentu. W cache scope nie ma
      // kontekstu requestu, więc auto-resolve interceptora jest zakazany —
      // jawny nagłówek wygrywa z interceptorem (patrz `withLocaleHeader`).
      headers: withLocaleHeaderForSlug(undefined, locale)
    });

    // Bez `.catch()`: błąd MUSI się propagować, żeby `unstable_cache` nie
    // zapisał pustej odpowiedzi jako poprawnej na cały TTL.
    return product_categories;
  }
});

export const listCategories = async ({
  query,
  locale
}: Partial<CategoriesProps> & { locale?: StorefrontLocaleSlug } = {}) => {
  const limit = query?.limit || 100;
  // AD-1: locale rozwiązane PRZED wejściem do cache. Wewnątrz callbacku
  // `resolveStorefrontLocaleSlug()` byłoby błędem (brak kontekstu requestu).
  const resolvedLocale = locale ?? (await resolveStorefrontLocaleSlug());

  // `getMarketId()` czyta `NEXT_PUBLIC_PAYLOAD_MARKET_ID` — env procesu, stałe
  // w obrębie deploymentu (deployment per-market, patrz gp-ops/markets).
  // Dlatego market NIE musi wchodzić do klucza cache. Dodatkowo cache'ujemy
  // odczyt SUROWY, a filtr market-scope stosujemy poza wpisem — gdyby model
  // deploymentu kiedyś się zmienił na multi-market-per-proces, ta warstwa
  // dalej jest poprawna bez zmiany klucza.
  const marketId = getMarketId();

  const allCategories = await fetchCategoriesCached(resolvedLocale, { limit, ...query });

  const filtered = filterByMarket(allCategories, marketId);
  const parentCategories = filtered.filter(cat => !cat.parent_category_id);

  // F3 fix: also filter category_children from the API tree — nested children
  // may lack metadata if Medusa doesn't populate it in the descendants tree.
  const mainCategories = filterByMarket(
    parentCategories.flatMap(parent => parent.category_children || []),
    marketId
  );

  const mainCategoriesWithChildren = mainCategories.map(mainCat => {
    const children = filtered.filter(cat => cat.parent_category_id === mainCat.id);

    if (children.length > 0) {
      return {
        ...mainCat,
        category_children: children
      };
    }

    return mainCat;
  });

  return {
    parentCategories,
    categories: mainCategoriesWithChildren
  };
};

/**
 * v1.14.0 Story 1.2 (review-fix 1-2-F4) — sentinel „brak trafienia".
 *
 * Rzucany zamiast zwracania `null`, żeby BRAK KATEGORII nie stał się
 * pełnoprawnym wpisem `unstable_cache` na 600 s. Bez tego świeżo opublikowana
 * kategoria zwracałaby `notFound()` do 10 minut po tym, jak faktycznie istnieje
 * (wystarczy jedno wejście bota/prefetch sekundę przed propagacją) — ryzyko
 * sprzężone z wsadowymi publikacjami z Epic 3 / EE-1. `unstable_cache` nie
 * zapisuje odrzuconej obietnicy, więc pustka nie przeżywa requestu; to NIE jest
 * ta sama klasa co zaakceptowana TTL-staleness z AC5 (tam chodzi o stare TREŚCI).
 */
class CategoryNotFoundError extends Error {
  constructor(handle: string) {
    super(`[categories] no category for handle "${handle}"`);
    this.name = 'CategoryNotFoundError';
  }
}

/**
 * Rozpoznanie po nazwie oprócz `instanceof` — granica `unstable_cache` może
 * (zależnie od runtime'u/serializacji) oddać rekonstruowany obiekt błędu.
 */
function isCategoryNotFound(error: unknown): boolean {
  return error instanceof Error && error.name === 'CategoryNotFoundError';
}

/**
 * v1.14.0 Story 1.2 (AD-1) — jak wyżej: locale w argumentach ⇒ w kluczu cache.
 */
const fetchCategoryByHandleCached = createLocaleKeyedCache({
  keyPrefix: 'storefront-category-by-handle',
  tagScope: CATEGORIES_CACHE_TAG_SCOPE,
  revalidate: CATEGORIES_CACHE_REVALIDATE_SECONDS,
  fetcher: async (
    locale: StorefrontLocaleSlug,
    categoryHandle: string
  ): Promise<HttpTypes.StoreProductCategory> => {
    const { product_categories } =
      await sdk.client.fetch<HttpTypes.StoreProductCategoryListResponse>(
        `/store/product-categories`,
        {
          query: {
            fields: CATEGORY_FIELDS,
            handle: categoryHandle
          },
          headers: withLocaleHeaderForSlug(undefined, locale)
        }
      );

    const category = product_categories[0];

    // 1-2-F4: brak trafienia rzuca, więc NIE trafia do cache na cały TTL.
    if (!category) {
      throw new CategoryNotFoundError(categoryHandle);
    }

    return category;
  }
});

export const getCategoryByHandle = async (
  categoryHandle: string,
  locale?: StorefrontLocaleSlug
) => {
  const resolvedLocale = locale ?? (await resolveStorefrontLocaleSlug());

  try {
    return await fetchCategoryByHandleCached(resolvedLocale, categoryHandle);
  } catch (error) {
    // Zastane call-site'y oczekują `undefined` dla braku trafienia. Błędy
    // backendu propagują się dalej (nie udajemy „nie ma takiej kategorii").
    if (isCategoryNotFound(error)) {
      return undefined;
    }
    throw error;
  }
};
