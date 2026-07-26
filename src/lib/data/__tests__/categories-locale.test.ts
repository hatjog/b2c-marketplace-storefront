/**
 * Locale header propagation test dla realnej funkcji z lib/data/* (Story 2.2, L-1).
 *
 * Pokrywa wording T5 Story 2.2: „dla każdego z 4 canonical locales wymusza
 * wywołanie typowej funkcji z lib/data/* i asercja: outgoing request zawiera
 * `x-medusa-locale` header". Test uderza w `listCategories()`.
 *
 * ZAKTUALIZOWANY w v1.14.0 Story 1.2 (T6): mechanizm propagacji się zmienił.
 * Do v1.13.0 nagłówek dokładał `applyLocaleInterceptor` na singletonie `sdk`
 * (auto-resolve z kontekstu requestu). Po Story 1.2 katalogowy odczyt biegnie
 * wewnątrz `unstable_cache`, gdzie kontekstu requestu NIE MA — nagłówek
 * pochodzi z jawnego slugu przekazanego do fetchera (`withLocaleHeaderForSlug`).
 *
 * Intencja testu jest ta sama (outgoing request niesie właściwy BCP-47 dla
 * każdego z 4 locale); zmienia się droga, którą tam trafia. Dodatkowo test
 * pokrywa teraz OBIE drogi: jawny slug ORAZ auto-resolve przed wejściem do cache.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SUPPORTED_LOCALES } from '@/i18n/routing';

const fetchMock = vi.fn();

// `unstable_cache` wymaga runtime'u Next (incremental cache w AsyncLocalStorage),
// którego vitest nie ma. Podmieniamy na przezroczysty passthrough — ten plik
// bada propagację nagłówka, nie semantykę klucza (ta jest w locale-keyed-cache.test.ts).
vi.mock('next/cache', () => ({
  unstable_cache:
    (fn: (...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      fn(...args)
}));

vi.mock('../../config', () => ({
  sdk: {
    client: {
      fetch: fetchMock
    }
  },
  mercurClient: {}
}));

vi.mock('../../helpers/market-filter', () => ({
  filterByMarket: <T,>(items: T[]) => items,
  getMarketId: () => 'bonbeauty'
}));

const resolveLocaleSlugMock = vi.fn();
vi.mock('../../sdk/locale-interceptor', async () => {
  const actual = await vi.importActual<typeof import('../../sdk/locale-interceptor')>(
    '../../sdk/locale-interceptor'
  );
  return {
    ...actual,
    resolveStorefrontLocaleSlug: () => resolveLocaleSlugMock()
  };
});

const { listCategories } = await import('../categories');

/** Slug routingu → oczekiwany BCP-47 na wyjściu (konwersja w withLocaleHeaderForSlug). */
const EXPECTED_CANONICAL: Record<string, string> = {
  pl: 'pl-PL',
  en: 'en-US',
  ua: 'uk-UA',
  de: 'de-DE'
};

describe('listCategories — x-medusa-locale header propagation (L-1)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ product_categories: [] });
    resolveLocaleSlugMock.mockReset();
    resolveLocaleSlugMock.mockResolvedValue('pl');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(SUPPORTED_LOCALES)(
    'jawny slug %s wysyła odpowiedni x-medusa-locale na /store/product-categories',
    async slug => {
      await listCategories({ locale: slug });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers).toMatchObject({
        'x-medusa-locale': EXPECTED_CANONICAL[slug]
      });
      // Jawny slug ⇒ auto-resolve w ogóle nie jest wołany.
      expect(resolveLocaleSlugMock).toHaveBeenCalledTimes(0);
    }
  );

  it.each(SUPPORTED_LOCALES)(
    'auto-resolve (%s) rozwiązany PRZED cache też trafia do nagłówka',
    async slug => {
      resolveLocaleSlugMock.mockResolvedValue(slug);

      await listCategories();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers).toMatchObject({
        'x-medusa-locale': EXPECTED_CANONICAL[slug]
      });
      // Dokładnie raz — na zewnątrz wrappera cache, nie w callbacku.
      expect(resolveLocaleSlugMock).toHaveBeenCalledTimes(1);
    }
  );
});
