/**
 * v1.14.0 Story 1.3 — AC1: reland lokalizowanego fetchu na route'ach detalu.
 *
 * Dowód jest BEHAWIORALNY (wymóg AC1): asercje stoją na TREŚCI zwróconej przez
 * pipeline PDP (`fetchProductForDetailPage` → `listProducts` → SDK), nie na
 * samej obecności nagłówka `x-medusa-locale` — asercja na nagłówku przeszłaby
 * też w wersji, którą v1.13.0 wycofał (cichy fallback do pl-PL w kontynuacji).
 *
 * Model backendu odpowiada semantyce Translation Module: odpowiedź zawiera
 * OVERLAY tłumaczenia zależny od `x-medusa-locale` (zmaterializowane
 * title/description/subtitle per locale). Test dowodzi, że:
 *  1. ten sam handle z locale `ua` renderowalnie zwraca treść UA, a z `pl`
 *     treść PL — rura z 1.2 faktycznie niesie zlokalizowaną treść (AC1);
 *  2. `subtitle` przechodzi przez `fields` (decyzja AC1/T2: subtitle wchodzi
 *     do fields, żeby overlay mógł go lokalizować);
 *  3. auto-resolve locale ma ZERO wywołań — locale płynie jawnie z argumentu
 *     route'u przez cały tor (AD-3), również w kontynuacji fetch;
 *  4. SPRZĘŻENIE KRYTYCZNE z 1.4 (E-3): przy stubie < 80 słów REALNY
 *     `checkQualityGate` odfiltrowuje produkt i PDP dostaje null — test
 *     dokumentuje to zachowanie, NIE osłabia gate'a (zakres 1.4/AD-4).
 *
 * Quality-gate NIE jest tu mockowany (inaczej niż w locale-keyed-cache.test.ts)
 * — właśnie po to, żeby punkt 4 był prawdziwym zachowaniem toru PDP.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LocaleInterceptorModule from '@/lib/sdk/locale-interceptor';

// --- Model Next Data Cache (jak w locale-keyed-cache.test.ts) ---------------

const cacheStore = new Map<string, { value: unknown }>();

vi.mock('next/cache', () => ({
  unstable_cache: (
    fn: (...args: unknown[]) => Promise<unknown>,
    keyParts: string[]
  ) => {
    return async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      const hit = cacheStore.get(key);
      if (hit) return hit.value;
      const value = await fn(...args);
      cacheStore.set(key, { value });
      return value;
    };
  }
}));

// --- SDK przez PRAWDZIWY interceptor (review-fix 1-2-F1 pattern) ------------

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

vi.mock('../cookies', () => ({
  getAuthHeaders: async () => ({}),
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

/** Spy na jedyne wejście auto-resolve importowane przez warstwę danych. */
const resolveLocaleSlugSpy = vi.fn(async () => 'pl' as 'pl' | 'en' | 'ua' | 'de');

vi.mock('@/lib/sdk/locale-interceptor', async () => {
  const actual =
    await vi.importActual<typeof LocaleInterceptorModule>('@/lib/sdk/locale-interceptor');
  return {
    ...actual,
    resolveStorefrontLocaleSlug: () => resolveLocaleSlugSpy()
  };
});

const { fetchProductForDetailPage } = await import('../product-detail-fetcher');

// --- Fixtures: zmaterializowany overlay Translation Module ------------------

/** ≥ 80 słów, żeby przejść REALNY checkQualityGate (MIN_DESCRIPTION_WORDS). */
function longDescription(word: string): string {
  return Array(85).fill(word).join(' ');
}

const OVERLAY_BY_LOCALE: Record<
  string,
  { title: string; description: string; subtitle: string }
> = {
  'pl-PL': {
    title: 'Masaż relaksacyjny',
    description: longDescription('relaks'),
    subtitle: 'Godzina spokoju'
  },
  'uk-UA': {
    title: 'Розслаблюючий масаж',
    description: longDescription('розслаблення'),
    subtitle: 'Година спокою'
  },
  'de-DE': {
    title: 'Entspannungsmassage',
    description: longDescription('Entspannung'),
    subtitle: 'Eine Stunde Ruhe'
  }
};

/** Stub < 80 słów — stan katalogu przed 1.4 (treści 4.4 to stuby). */
const STUB_DESCRIPTION_WORDS = 12;

function productPayload(locale: string, options?: { stub?: boolean }) {
  const overlay = OVERLAY_BY_LOCALE[locale] ?? OVERLAY_BY_LOCALE['pl-PL'];
  return {
    id: 'prod_massage',
    handle: 'masaz-relaksacyjny',
    title: overlay.title,
    subtitle: overlay.subtitle,
    description: options?.stub
      ? Array(STUB_DESCRIPTION_WORDS).fill('stub').join(' ')
      : overlay.description,
    thumbnail: 'https://cdn.example/masaz.jpg',
    variants: [{ calculated_price: { calculated_amount: 18000, currency_code: 'PLN' } }],
    metadata: {},
    // Słownik Mercur 2: aktywny sprzedawca to `seller.status === 'open'`
    // (legacy `store_status: 'ACTIVE'` z Mercur 1.5 to już tylko shim w
    // normalize-listed-products.ts — fixture nie utrwala starego enuma).
    seller: { id: 'sel_1', name: 'Salon', handle: 'salon', status: 'open' }
  };
}

beforeEach(() => {
  cacheStore.clear();
  fetchMock.mockReset();
  interceptorResolveSpy.mockClear();
  resolveLocaleSlugSpy.mockClear();

  fetchMock.mockImplementation(
    async (_path: string, options: { headers?: Record<string, string> }) => {
      const locale = options?.headers?.['x-medusa-locale'] ?? '<brak>';
      return { products: [productPayload(locale)], count: 1 };
    }
  );
});

describe('Story 1.3 AC1 — PDP renderuje zmaterializowane tłumaczenie, nie PL fallback', () => {
  it('ten sam handle: locale ua ⇒ treść UA; locale pl ⇒ treść PL (asercja na treści)', async () => {
    const ua = await fetchProductForDetailPage('masaz-relaksacyjny', 'pl', 'ua');
    const pl = await fetchProductForDetailPage('masaz-relaksacyjny', 'pl', 'pl');

    // Treść UA zmaterializowana — NIE bazowy PL.
    expect(ua?.title).toBe('Розслаблюючий масаж');
    expect(ua?.description).toContain('розслаблення');
    expect(ua?.title).not.toBe(pl?.title);

    // Parzystość: /pl dostaje treść PL.
    expect(pl?.title).toBe('Masaż relaksacyjny');
    expect(pl?.description).toContain('relaks');

    // Locale płynie JAWNIE — zero auto-resolve w całej kontynuacji (AD-3).
    expect(resolveLocaleSlugSpy).not.toHaveBeenCalled();
    expect(interceptorResolveSpy).not.toHaveBeenCalled();

    // Review 1-3-F2 (H2): asercja na NAGŁÓWKU żądania per locale — kanał
    // niezależny od asercji na treści powyżej. Treść dowodzi „co wróciło",
    // nagłówek dowodzi „o co tor faktycznie poprosił" — razem wykluczają
    // wariant, w którym mock przypadkiem zwraca dobrą treść mimo złego locale.
    const sentLocales = fetchMock.mock.calls.map(
      ([, options]) =>
        (options as { headers?: Record<string, string> })?.headers?.['x-medusa-locale']
    );
    expect(sentLocales).toContain('uk-UA');
    expect(sentLocales).toContain('pl-PL');
    expect(sentLocales).not.toContain(undefined);
  });

  it('subtitle wchodzi do fields i wraca zlokalizowany (decyzja AC1/T2)', async () => {
    const de = await fetchProductForDetailPage('masaz-relaksacyjny', 'pl', 'de');

    expect(de?.subtitle).toBe('Eine Stunde Ruhe');

    // Kontrakt zapytania: `subtitle` jest na liście fields (bez tego overlay
    // Translation Module nie miałby czego lokalizować).
    const [, requestOptions] = fetchMock.mock.calls[0] as [
      string,
      { query?: { fields?: string } }
    ];
    expect(requestOptions.query?.fields).toContain('subtitle');
  });

  it('SPRZĘŻENIE 1.4 (E-3): stub < 80 słów jest odfiltrowany przez REALNY quality-gate — PDP dostaje null (raportujemy, nie kompensujemy)', async () => {
    fetchMock.mockImplementation(
      async (_path: string, options: { headers?: Record<string, string> }) => {
        const locale = options?.headers?.['x-medusa-locale'] ?? '<brak>';
        return { products: [productPayload(locale, { stub: true })], count: 1 };
      }
    );

    const ua = await fetchProductForDetailPage('masaz-relaksacyjny-stub', 'pl', 'ua');

    // To jest udokumentowane zachowanie E-3 (architecture AD-4), którego
    // rozwiązanie (content_bar) należy do Story 1.4 — NIE do tej story.
    expect(ua).toBeNull();
  });
});
