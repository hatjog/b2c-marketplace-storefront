/**
 * v1.14.0 Story 1.2 — AC4: test przecieku locale z Data Cache (pre-check HG-13).
 *
 * Co dowodzimy (i dlaczego akurat tak):
 *  1. Sekwencja `/pl → /ua` na TYM SAMYM zasobie daje DWA rozłączne wpisy cache
 *     i DWIE odpowiedzi w różnych językach — czyli klucz waryjuje po locale.
 *  2. NON-VACUOUS: powtórzenie tego samego locale to HIT (zero nowych wywołań
 *     SDK). Bez tej asercji „zero przecieku" byłoby trywialnie prawdziwe przy
 *     całkowicie wyłączonym cache — dokładnie stan sprzed tej story (`no-store`).
 *  3. W cache scope locale jest JAWNE: `resolveStorefrontLocale` ma ZERO wywołań
 *     wewnątrz callbacku, a wychodzący `x-medusa-locale` pochodzi z argumentu.
 *  4. Tor z `authorization` NIE dzieli wpisu z anonimowym (PUŁAPKA auth).
 *  5. Budżety TTL to nazwane stałe 300/600 (AC5), nie magic numbers.
 *
 * `unstable_cache` jest tu podmieniony na wierny model semantyki Next
 * (klucz = keyParts + argumenty callbacku), bo prawdziwy Data Cache wymaga
 * runtime'u Next. Model jest CELOWO minimalny: gdyby locale wypadło z klucza,
 * test 1 zrobiłby się czerwony, a nie zielony-przez-przypadek.
 *
 * Formalny E2E cache-leak (HG-13 evidence) należy do Story 5.5 — tu jest
 * pre-check na poziomie warstwy danych.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Aliasy typów (import type jest wymazywany, więc nie kolidują z hoistingiem
// `vi.mock`) — pozwalają uniknąć zakazanych adnotacji `typeof import(...)`.
import type * as LocaleInterceptorModule from '@/lib/sdk/locale-interceptor';

// --- Model Next Data Cache -------------------------------------------------

type CacheEntry = { value: unknown };

const cacheStore = new Map<string, CacheEntry>();
const cacheTagsByKey = new Map<string, string[]>();
let cacheHits = 0;
let cacheMisses = 0;

vi.mock('next/cache', () => ({
  unstable_cache: (
    fn: (...args: unknown[]) => Promise<unknown>,
    keyParts: string[],
    options: { revalidate?: number; tags?: string[] }
  ) => {
    return async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      const hit = cacheStore.get(key);
      if (hit) {
        cacheHits++;
        return hit.value;
      }
      cacheMisses++;
      const value = await fn(...args);
      cacheStore.set(key, { value });
      cacheTagsByKey.set(key, options?.tags ?? []);
      return value;
    };
  }
}));

// --- Mocki warstwy poniżej cache ------------------------------------------

/**
 * review-fix 1-2-F1: testowy `sdk` przechodzi przez `applyLocaleInterceptor`,
 * czyli przez DOKŁADNIE tę warstwę, która w produkcji wykonuje fetch. Wcześniej
 * mock podmieniał `@/lib/config` na goły obiekt, więc interceptor znikał —
 * a razem z nim jedyne miejsce, w którym auto-resolve mógł wejść do cache scope.
 * Asercja „zero auto-resolve w cache scope" była wtedy zielona z konstrukcji.
 *
 * `interceptorResolveSpy` stoi w miejscu `resolveStorefrontLocale` (a więc
 * `getLocale()` z next-intl) — jego wywołanie w cache scope to naruszenie AD-1.
 */
const { fetchMock, interceptorResolveSpy } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  interceptorResolveSpy: vi.fn(async () => 'pl-PL' as 'pl-PL' | 'en-US' | 'uk-UA' | 'de-DE')
}));

vi.mock('@/lib/config', async () => {
  const { applyLocaleInterceptor } =
    await vi.importActual<typeof LocaleInterceptorModule>('@/lib/sdk/locale-interceptor');

  return {
    sdk: applyLocaleInterceptor(
      { client: { fetch: (...args: unknown[]) => fetchMock(...args) } },
      interceptorResolveSpy
    ),
    mercurClient: {}
  };
});

const getAuthHeadersMock = vi.fn(async () => ({}) as Record<string, string>);

vi.mock('../cookies', () => ({
  getAuthHeaders: () => getAuthHeadersMock(),
  getCacheTag: async () => '',
  getCacheOptions: async () => ({})
}));

vi.mock('../regions', () => ({
  getRegion: async () => ({ id: 'reg_pl', currency_code: 'pln' }),
  retrieveRegion: async () => ({ id: 'reg_pl', currency_code: 'pln' })
}));

vi.mock('../customer', () => ({
  retrieveCustomer: async () => null
}));

// Quality-gate normalizacji należy do Story 1.4 — tu interesuje nas wyłącznie
// semantyka klucza cache, więc normalizer jest przezroczysty.
vi.mock('@/lib/helpers/normalize-listed-products', () => ({
  normalizeListedProducts: (products: unknown[]) => products
}));

/**
 * Spy na auto-resolve locale. Podmieniamy `resolveStorefrontLocaleSlug`, bo to
 * JEDYNE wejście auto-resolve, które importuje warstwa danych — spy na
 * `resolveStorefrontLocale` byłby wadliwy: wywołania wewnątrzmodułowe nie
 * przechodzą przez podmieniony eksport, więc asercja „zero wywołań" byłaby
 * trywialnie prawdziwa (vacuous).
 *
 * Druga połowa gwarancji jest typowa, nie testowa: w cache scope wołamy
 * `withLocaleHeaderForSlug`, które jest synchroniczne i ma WYMAGANY slug —
 * nie ma tam żadnej ścieżki fallbacku, którą dałoby się przypadkiem trafić.
 */
const resolveLocaleSlugSpy = vi.fn(async () => 'pl' as 'pl' | 'en' | 'ua' | 'de');

vi.mock('@/lib/sdk/locale-interceptor', async () => {
  const actual =
    await vi.importActual<typeof LocaleInterceptorModule>('@/lib/sdk/locale-interceptor');
  return {
    ...actual,
    resolveStorefrontLocaleSlug: () => resolveLocaleSlugSpy()
  };
});

const { listCategories, getCategoryByHandle } = await import('../categories');
const { listProducts } = await import('../products');
const { fetchProductForDetailPage } = await import('../product-detail-fetcher');
const { CATEGORIES_CACHE_REVALIDATE_SECONDS, PRODUCTS_CACHE_REVALIDATE_SECONDS } = await import(
  '../cache-budgets'
);

// --- Fixtures --------------------------------------------------------------

/** Nazwa kategorii zależna od locale — nośnik dowodu „treści w dwóch językach". */
const CATEGORY_NAME_BY_LOCALE: Record<string, string> = {
  'pl-PL': 'Zabiegi na twarz',
  'uk-UA': 'Догляд за обличчям',
  'en-US': 'Facial treatments',
  'de-DE': 'Gesichtsbehandlungen'
};

const PRODUCT_TITLE_BY_LOCALE: Record<string, string> = {
  'pl-PL': 'Masaż relaksacyjny',
  'uk-UA': 'Розслаблюючий масаж',
  'en-US': 'Relaxing massage',
  'de-DE': 'Entspannungsmassage'
};

function localeOf(options: { headers?: Record<string, string> } | undefined): string {
  return options?.headers?.['x-medusa-locale'] ?? '<brak>';
}

function outgoingLocales(): string[] {
  return fetchMock.mock.calls.map(([, options]) => localeOf(options));
}

beforeEach(() => {
  cacheStore.clear();
  cacheTagsByKey.clear();
  cacheHits = 0;
  cacheMisses = 0;
  fetchMock.mockReset();
  interceptorResolveSpy.mockClear();
  interceptorResolveSpy.mockResolvedValue('pl-PL');
  resolveLocaleSlugSpy.mockClear();
  resolveLocaleSlugSpy.mockResolvedValue('pl');
  getAuthHeadersMock.mockReset();
  getAuthHeadersMock.mockResolvedValue({});

  fetchMock.mockImplementation(async (path: string, options: { headers?: Record<string, string> }) => {
    const locale = localeOf(options);

    if (path.includes('product-categories')) {
      return {
        product_categories: [
          {
            id: 'pcat_face',
            handle: 'twarz',
            name: CATEGORY_NAME_BY_LOCALE[locale] ?? `??-${locale}`,
            parent_category_id: null,
            category_children: []
          }
        ]
      };
    }

    return {
      products: [
        {
          id: 'prod_massage',
          handle: 'masaz',
          title: PRODUCT_TITLE_BY_LOCALE[locale] ?? `??-${locale}`
        }
      ],
      count: 1
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- AC4: przeciek /pl → /ua ----------------------------------------------

describe('AC4 — sekwencja /pl → /ua na tym samym zasobie (kategorie)', () => {
  it('zwraca treści w DWÓCH językach i tworzy DWA rozłączne wpisy cache', async () => {
    const pl = await listCategories({ locale: 'pl' });
    const ua = await listCategories({ locale: 'ua' });

    expect(pl.parentCategories[0].name).toBe('Zabiegi na twarz');
    expect(ua.parentCategories[0].name).toBe('Догляд за обличчям');
    expect(ua.parentCategories[0].name).not.toBe(pl.parentCategories[0].name);

    // Dwa MISS-y = dwa rozłączne wpisy; zero HIT-ów = nic nie przeciekło.
    expect(cacheMisses).toBe(2);
    expect(cacheHits).toBe(0);
    expect(cacheStore.size).toBe(2);

    // Nagłówek wychodzący pochodzi z ARGUMENTU, nie z auto-resolve.
    expect(outgoingLocales()).toEqual(['pl-PL', 'uk-UA']);
  });

  it('NON-VACUOUS: powtórzenie tego samego locale to HIT (cache faktycznie działa)', async () => {
    await listCategories({ locale: 'pl' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await listCategories({ locale: 'pl' });

    // Gdyby cache był wyłączony (stan sprzed story: `no-store`), byłoby 2.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cacheHits).toBe(1);
    expect(second.parentCategories[0].name).toBe('Zabiegi na twarz');
  });

  it('wpisy per locale mają rozłączne tagi rewalidacji', async () => {
    await listCategories({ locale: 'pl' });
    await listCategories({ locale: 'ua' });

    const tags = [...cacheTagsByKey.values()].flat();
    expect(tags).toContain('product-categories-pl-PL');
    expect(tags).toContain('product-categories-uk-UA');
    expect(new Set(tags).size).toBe(2);
  });

  it('pełna macierz 4 locale = 4 rozłączne wpisy i 4 różne treści', async () => {
    const names: string[] = [];
    for (const locale of ['pl', 'en', 'ua', 'de'] as const) {
      const res = await listCategories({ locale });
      names.push(res.parentCategories[0].name);
    }

    expect(new Set(names).size).toBe(4);
    expect(cacheStore.size).toBe(4);
    expect(cacheHits).toBe(0);
  });
});

describe('AC4 — sekwencja /pl → /ua na tym samym zasobie (getCategoryByHandle)', () => {
  it('rozłączne wpisy per locale, HIT przy powtórzeniu', async () => {
    const pl = await getCategoryByHandle('twarz', 'pl');
    const ua = await getCategoryByHandle('twarz', 'ua');
    await getCategoryByHandle('twarz', 'pl');

    expect(pl?.name).toBe('Zabiegi na twarz');
    expect(ua?.name).toBe('Догляд за обличчям');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cacheHits).toBe(1);
  });

  // review-fix 1-2-F4: brak trafienia NIE może zostać zapisany na 600 s —
  // inaczej świeżo opublikowana kategoria jest 404 przez cały TTL.
  it('brak trafienia NIE jest cache’owany (świeżo dodana kategoria nie jest 404 na TTL)', async () => {
    fetchMock.mockResolvedValueOnce({ product_categories: [] });

    const missing = await getCategoryByHandle('swiezo-dodana', 'pl');
    expect(missing).toBeUndefined();
    expect(cacheStore.size).toBe(0);

    // Kategoria pojawia się w backendzie sekundę później — widać ją od razu.
    const found = await getCategoryByHandle('swiezo-dodana', 'pl');
    expect(found?.name).toBe('Zabiegi na twarz');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('inny handle to inny wpis (klucz obejmuje argumenty, nie tylko locale)', async () => {
    await getCategoryByHandle('twarz', 'pl');
    await getCategoryByHandle('dlonie', 'pl');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cacheStore.size).toBe(2);
  });
});

describe('AC4 — sekwencja /pl → /ua na tym samym zasobie (listProducts)', () => {
  it('zwraca treści w DWÓCH językach i tworzy DWA rozłączne wpisy cache', async () => {
    const pl = await listProducts({ countryCode: 'pl', locale: 'pl' });
    const ua = await listProducts({ countryCode: 'pl', locale: 'ua' });

    expect(pl.response.products[0].title).toBe('Masaż relaksacyjny');
    expect(ua.response.products[0].title).toBe('Розслаблюючий масаж');
    expect(cacheStore.size).toBe(2);
    expect(outgoingLocales()).toEqual(['pl-PL', 'uk-UA']);
  });

  it('NON-VACUOUS: drugi odczyt tego samego locale nie woła SDK', async () => {
    await listProducts({ countryCode: 'pl', locale: 'pl' });
    await listProducts({ countryCode: 'pl', locale: 'pl' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cacheHits).toBe(1);
  });

  it('parametry zapytania są w kluczu — inna strona nie dostaje cudzego wpisu', async () => {
    await listProducts({ countryCode: 'pl', locale: 'pl', pageParam: 1 });
    await listProducts({ countryCode: 'pl', locale: 'pl', pageParam: 2 });
    await listProducts({ countryCode: 'pl', locale: 'pl', category_id: 'pcat_face' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(cacheStore.size).toBe(3);
  });

  it('błąd backendu NIE jest cache’owany jako pusty katalog', async () => {
    fetchMock.mockRejectedValueOnce(new Error('backend 503'));

    const failed = await listProducts({ countryCode: 'pl', locale: 'pl' });
    expect(failed.response.products).toEqual([]);
    // Pustka nie trafiła do cache…
    expect(cacheStore.size).toBe(0);

    // …więc kolejny odczyt znowu uderza do backendu i dostaje poprawne dane.
    const recovered = await listProducts({ countryCode: 'pl', locale: 'pl' });
    expect(recovered.response.products[0].title).toBe('Masaż relaksacyjny');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('AC4 — PDP (fetchProductForDetailPage)', () => {
  it('locale z route’u waryjuje wpis: /pl i /ua nie dzielą odpowiedzi', async () => {
    const pl = await fetchProductForDetailPage('masaz', 'pl', 'pl');
    const ua = await fetchProductForDetailPage('masaz', 'pl', 'ua');

    expect(pl?.title).toBe('Masaż relaksacyjny');
    expect(ua?.title).toBe('Розслаблюючий масаж');
    expect(cacheStore.size).toBe(2);
  });
});

// --- QD-03 (CAP-3): symetria kolejności PL→DE i DE→PL ---------------------
//
// Blok wyżej mierzy JEDNĄ kolejność (pl → ua). Cache bleed jest jednak
// asymetryczny z natury: przecieka ten wpis, który został zapisany PIERWSZY.
// Test, który zawsze grzeje cache tym samym locale, nie odróżni „klucz zawiera
// locale" od „pierwszy zapis wygrywa". Dlatego QD-03 mierzy OBIE kolejności na
// tym samym zasobie — i robi to w TYM pliku, żeby nie powstał drugi,
// niezależnie napisany model semantyki `unstable_cache` (nowy model = nowy
// drift; ta sama zasada, którą QD-01 zastosował do reguły homepage).

describe('QD-03 — kolejność PL→DE i DE→PL nie zmienia wyniku', () => {
  it('PL→DE: DE nie dostaje payloadu PL', async () => {
    const pl = await listProducts({ countryCode: 'pl', locale: 'pl' });
    const de = await listProducts({ countryCode: 'pl', locale: 'de' });

    expect(pl.response.products[0].title).toBe('Masaż relaksacyjny');
    expect(de.response.products[0].title).toBe('Entspannungsmassage');
    expect(cacheMisses).toBe(2);
    expect(cacheHits).toBe(0);
  });

  it('DE→PL: PL nie dostaje payloadu DE (symetria)', async () => {
    const de = await listProducts({ countryCode: 'pl', locale: 'de' });
    const pl = await listProducts({ countryCode: 'pl', locale: 'pl' });

    expect(de.response.products[0].title).toBe('Entspannungsmassage');
    expect(pl.response.products[0].title).toBe('Masaż relaksacyjny');
    expect(cacheMisses).toBe(2);
    expect(cacheHits).toBe(0);
  });

  it('PDP: obie kolejności dają dwa rozłączne wpisy i dwa języki', async () => {
    const firstDe = await fetchProductForDetailPage('masaz', 'pl', 'de');
    const thenPl = await fetchProductForDetailPage('masaz', 'pl', 'pl');

    expect(firstDe?.title).toBe('Entspannungsmassage');
    expect(thenPl?.title).toBe('Masaż relaksacyjny');
    expect(cacheStore.size).toBe(2);

    // NON-VACUOUS: powrót do locale zapisanego jako pierwszy to HIT, a nie
    // kolejny MISS — czyli wpisy naprawdę istnieją obok siebie.
    const hitsBefore = cacheHits;
    const againDe = await fetchProductForDetailPage('masaz', 'pl', 'de');
    expect(againDe?.title).toBe('Entspannungsmassage');
    expect(cacheHits).toBe(hitsBefore + 1);
    expect(cacheStore.size).toBe(2);
  });
});

// --- AC2: jawność locale w cache scope ------------------------------------

describe('AC2 — w cache scope locale jest JAWNE, auto-resolve zakazany', () => {
  it('callback cache NIE woła resolveStorefrontLocale (spy = 0 w cache scope)', async () => {
    await listCategories({ locale: 'ua' });
    await listProducts({ countryCode: 'pl', locale: 'ua' });

    // Locale podane jawnie na obu ścieżkach ⇒ auto-resolve nie jest w ogóle potrzebny.
    expect(resolveLocaleSlugSpy).toHaveBeenCalledTimes(0);
    expect(outgoingLocales()).toEqual(['uk-UA', 'uk-UA']);
  });

  // review-fix 1-2-F1: to jest asercja, której poprzednia wersja testu nie
  // mogła postawić — interceptor był wycięty przez mock `@/lib/config`.
  it('interceptor NIE rozwiązuje locale wewnątrz cache scope (auto-resolve = 0)', async () => {
    await listCategories({ locale: 'ua' });
    await getCategoryByHandle('twarz', 'de');
    await listProducts({ countryCode: 'pl', locale: 'en' });

    // Jawny `x-medusa-locale` z `withLocaleHeaderForSlug` ⇒ interceptor nie
    // sięga po kontekst requestu (`getLocale()`), który w cache scope rzuca
    // i cicho degraduje do pl-PL.
    expect(interceptorResolveSpy).toHaveBeenCalledTimes(0);
    expect(outgoingLocales()).toEqual(['uk-UA', 'de-DE', 'en-US']);
  });

  it('NON-VACUOUS: bez jawnego nagłówka interceptor JEST tym, kto rozwiązuje locale', async () => {
    // Guard test-the-test: gdyby spy nie był wpięty, asercja wyżej byłaby
    // trywialnie zielona niezależnie od stanu kodu produkcyjnego.
    const { sdk } = await import('@/lib/config');
    interceptorResolveSpy.mockResolvedValue('uk-UA');

    await sdk.client.fetch('/store/products', {});

    expect(interceptorResolveSpy).toHaveBeenCalledTimes(1);
    expect(outgoingLocales()).toEqual(['uk-UA']);
  });

  it('auto-resolve zachodzi PRZED wejściem do cache, gdy locale pominięto', async () => {
    resolveLocaleSlugSpy.mockResolvedValue('ua');

    await listCategories();

    // Dokładnie jedno wywołanie — poza cache scope, na zewnątrz wrappera.
    expect(resolveLocaleSlugSpy).toHaveBeenCalledTimes(1);
    expect(outgoingLocales()).toEqual(['uk-UA']);

    // …a wynik i tak wylądował pod kluczem locale-owym (drugi odczyt = HIT).
    await listCategories();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cacheHits).toBe(1);
  });
});

// --- AC2/AC5: rozcięcie toru auth -----------------------------------------

describe('AC2/AC5 — dane zależne od sesji nie wchodzą do współdzielonego wpisu', () => {
  it('odczyt z authorization NIE dzieli wpisu z anonimowym i nie tworzy wpisu cache', async () => {
    await listProducts({ countryCode: 'pl', locale: 'pl' });
    expect(cacheStore.size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    getAuthHeadersMock.mockResolvedValue({ authorization: 'Bearer jwt-klientki-A' });

    await listProducts({ countryCode: 'pl', locale: 'pl' });

    // Tor auth ominął cache: nowe wywołanie SDK, zero nowych wpisów, zero HIT-ów.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cacheStore.size).toBe(1);
    expect(cacheHits).toBe(0);

    // Nagłówek sesji poszedł do backendu, ale nie wszedł do klucza cache.
    const [, authOptions] = fetchMock.mock.calls[1];
    expect(authOptions.headers.authorization).toBe('Bearer jwt-klientki-A');
  });

  it('token jednej klientki nie może trafić do odpowiedzi drugiej (dwa różne tokeny)', async () => {
    getAuthHeadersMock.mockResolvedValue({ authorization: 'Bearer jwt-A' });
    await listProducts({ countryCode: 'pl', locale: 'pl' });

    getAuthHeadersMock.mockResolvedValue({ authorization: 'Bearer jwt-B' });
    await listProducts({ countryCode: 'pl', locale: 'pl' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cacheStore.size).toBe(0);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer jwt-A');
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe('Bearer jwt-B');
  });

  it('anonimowy wpis nie zawiera nagłówka authorization', async () => {
    await listProducts({ countryCode: 'pl', locale: 'pl' });

    const [, anonOptions] = fetchMock.mock.calls[0];
    expect(anonOptions.headers.authorization).toBeUndefined();
    expect(anonOptions.headers['x-medusa-locale']).toBe('pl-PL');
  });
});

// --- AC5: budżety TTL ------------------------------------------------------

describe('AC5 — budżety revalidate wg AD-14 są nazwanymi stałymi', () => {
  it('products = 300 s, categories = 600 s', () => {
    expect(PRODUCTS_CACHE_REVALIDATE_SECONDS).toBe(300);
    expect(CATEGORIES_CACHE_REVALIDATE_SECONDS).toBe(600);
  });
});
