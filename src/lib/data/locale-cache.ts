import { unstable_cache } from 'next/cache';

import type { StorefrontLocaleSlug } from '@/lib/sdk/locale-interceptor';
import { localeCacheTagForSlug } from '@/lib/sdk/locale-interceptor';

/**
 * v1.14.0 Story 1.2 (AD-1) — wspólny konstruktor locale-keyed Data Cache.
 *
 * Wzorzec źródłowy: `src/lib/sdk-adapters/sellers.ts` (`resolveSellerHandleToIdCached`).
 * Ten helper dokłada do tamtego kształtu dwie rzeczy, których AD-1 wymaga, a
 * pojedyncze wywołanie `unstable_cache` samo z siebie nie daje:
 *
 *  1. **locale w `keyParts`** — `unstable_cache` liczy klucz z `keyParts` ORAZ
 *     z argumentów callbacku; locale jest w OBU (argument + keyPart), więc
 *     wpisy PL/EN/UA/DE są strukturalnie rozłączne niezależnie od tego, czy
 *     Next zdąży zserializować argumenty tak samo między buildami;
 *  2. **tag per locale** — `options.tags` jest statyczne dla danej instancji
 *     `unstable_cache`, więc instancję budujemy LENIWIE per locale i memoizujemy.
 *     Dzięki temu `tags: [localeCacheTagForSlug(scope, locale)]` faktycznie
 *     waryjuje po locale (rewalidacja `products-uk-UA` nie zdmuchuje `products-pl-PL`).
 *
 * ZAKAZY (AD-1), których ten helper nie egzekwuje sam z siebie — pilnuje ich
 * lint-gate `gp/locale-cache-boundary` i review:
 *  - w `fetcher` NIE WOLNO wołać `headers()`, `cookies()`, `getLocale()`,
 *    `resolveStorefrontLocale()` ani niczego, co czyta kontekst requestu;
 *  - locale MUSI być rozwiązane przed wejściem tutaj i przekazane jawnie;
 *  - `fetcher` NIE MOŻE łykać błędów i zwracać „pustej, ale poprawnej”
 *    odpowiedzi — rzucony wyjątek nie trafia do cache, przechwycona pustka
 *    zostałaby zapisana na cały TTL (regresja „wyzerowany katalog”).
 */
export function createLocaleKeyedCache<TArgs extends unknown[], TResult>({
  keyPrefix,
  tagScope,
  revalidate,
  fetcher
}: {
  /** Stabilny prefiks klucza cache (nazwa fetchera). */
  keyPrefix: string;
  /** Scope tagu rewalidacji, np. `products` / `product-categories`. */
  tagScope: string;
  /** TTL w sekundach — podawaj nazwaną stałą z `cache-budgets.ts`. */
  revalidate: number;
  /** Czysty odczyt, bez kontekstu requestu. Locale zawsze pierwszym argumentem. */
  fetcher: (locale: StorefrontLocaleSlug, ...args: TArgs) => Promise<TResult>;
}): (locale: StorefrontLocaleSlug, ...args: TArgs) => Promise<TResult> {
  type Cached = (locale: StorefrontLocaleSlug, ...args: TArgs) => Promise<TResult>;

  const byLocale = new Map<StorefrontLocaleSlug, Cached>();

  return (locale, ...args) => {
    let cached = byLocale.get(locale);

    if (!cached) {
      cached = unstable_cache(fetcher, [keyPrefix, locale], {
        revalidate,
        tags: [localeCacheTagForSlug(tagScope, locale)]
      }) as Cached;
      byLocale.set(locale, cached);
    }

    return cached(locale, ...args);
  };
}
