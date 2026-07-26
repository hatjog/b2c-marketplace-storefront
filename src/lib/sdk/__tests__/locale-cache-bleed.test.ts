// Story 7.5 / AC2 / FR8 / ra-3 — regression assert: cross-locale cache bleed fix.
// PRZEPISANY w v1.14.0 Story 1.2 (AD-1, AC4) — patrz nota „ODWRÓCENIE TEZY".
//
// ODWRÓCENIE TEZY (v1.14.0 vs v1.12.0):
//   Poprzednia wersja tego pliku twierdziła, że faktyczną barierą anty-bleed
//   jest `cache: 'no-store'` na katalogowych odczytach, a `localeCacheTag` to
//   „tylko util do rewalidacji". To było poprawne dla v1.12.0, gdzie jedyną
//   alternatywą był wspólny `force-cache` na tym samym URL (klucz Next Data
//   Cache NIE wlicza nagłówków ⇒ pierwszy pobrany locale przeciekał na resztę,
//   bug live PL→UA).
//
//   Story 1.2 wymienia obejście na właściwy mechanizm: barierą jest teraz
//   KLUCZ `unstable_cache`, w którym locale jest JAWNYM ARGUMENTEM. `no-store`
//   znika, ale `force-cache` NIE wraca — i to jest tu asertowane wprost.
//
// Ten plik asercjonuje (statycznie, bez żywego stacku):
//   (a) `localeCacheTag` / `localeCacheTagForSlug` dają rozłączne tagi per locale
//       i obie drogi dają IDENTYCZNY tag (jedna konwencja nazewnictwa);
//   (b) katalogowe odczyty przechodzą przez `unstable_cache` z locale w
//       argumentach, a NIE przez `force-cache` + nagłówek;
//   (c) singleton `sdk` przechodzi przez `applyLocaleInterceptor`.
// Behawioralny dowód rozłączności wpisów (MISS/MISS dla pl→ua, HIT dla pl→pl)
// jest w `src/lib/data/__tests__/locale-keyed-cache.test.ts`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/i18n/routing';

import {
  CANONICAL_LOCALES,
  canonicalFromSlug,
  localeCacheTag,
  localeCacheTagForSlug
} from '../locale-interceptor';

const CACHED_SCOPES = ['products', 'product-categories'] as const;

const DATA_DIR = resolve(__dirname, '../../data');
const PRODUCTS_SRC = readFileSync(resolve(DATA_DIR, 'products.ts'), 'utf-8');
const CATEGORIES_SRC = readFileSync(resolve(DATA_DIR, 'categories.ts'), 'utf-8');
const LOCALE_CACHE_SRC = readFileSync(resolve(DATA_DIR, 'locale-cache.ts'), 'utf-8');
const PDP_FETCHER_SRC = readFileSync(resolve(DATA_DIR, 'product-detail-fetcher.ts'), 'utf-8');
const CONFIG_SRC = readFileSync(resolve(__dirname, '../../config.ts'), 'utf-8');

/**
 * Zdejmuje komentarze, żeby guardy patrzyły na KOD, a nie na noty
 * historyczne — te celowo cytują zakazane formy (`force-cache`, `no-store`,
 * `forceCache: true`), żeby udokumentować, czego pilnujemy.
 *
 * OGRANICZENIE (review-fix 1-2-F8, świadome): to jest strip regexowy, nie
 * parser. Sekwencje `/* *\/` i `//` WEWNĄTRZ literałów stringowych też zostaną
 * usunięte. Dla dzisiejszej treści tych trzech plików działa poprawnie, a
 * właściwą (parserową) egzekucją granicy jest lint-gate `gp/locale-cache-boundary` —
 * te guardy są dodatkową, tanią siatką na regresję przez copy-paste.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * review-fix 1-2-F8: guard na `cache: '<mode>'` tolerujący dowolny whitespace
 * i typ cudzysłowu (`'`, `"`, backtick). Poprzedni `toContain("cache: 'force-cache'")`
 * łapał JEDNĄ literalną formę — `cache:"force-cache"` przechodziło na zielono.
 */
function cacheModeRegex(mode: string): RegExp {
  return new RegExp(`cache\\s*:\\s*['"\`]${mode}['"\`]`);
}

const PRODUCTS_CODE = codeOnly(PRODUCTS_SRC);
const CATEGORIES_CODE = codeOnly(CATEGORIES_SRC);
const PDP_FETCHER_CODE = codeOnly(PDP_FETCHER_SRC);

describe('cross-locale cache bleed — locale-aware tags (AC2, FR8, ra-3)', () => {
  it('non-vacuous: są co najmniej 2 kanoniczne locale (PL/EN/UA/DE)', () => {
    // Guard test-the-test: pusty zbiór locale unieważniłby asercję disjoint.
    expect(CANONICAL_LOCALES.length).toBeGreaterThanOrEqual(2);
    expect([...CANONICAL_LOCALES]).toEqual(['pl-PL', 'en-US', 'uk-UA', 'de-DE']);
  });

  it.each(CACHED_SCOPES)(
    'localeCacheTag(%s) jest różny i rozłączny dla wszystkich locale (PL≠EN≠UA≠DE)',
    async scope => {
      const tags = await Promise.all(
        CANONICAL_LOCALES.map(locale => localeCacheTag(scope, locale))
      );

      // Każdy tag niepusty i zawiera swój locale (audytowalność, C8).
      tags.forEach((tag, i) => {
        expect(tag, `scope=${scope} locale=${CANONICAL_LOCALES[i]}`).toBeTruthy();
        expect(tag).toContain(CANONICAL_LOCALES[i]);
        expect(tag).toContain(scope);
      });

      // DISJOINT: liczba unikalnych tagów == liczba locale (żadne dwa nie dzielą tagu).
      const unique = new Set(tags);
      expect(unique.size, `scope=${scope}: tagi NIE są rozłączne ⇒ cache bleed`).toBe(
        CANONICAL_LOCALES.length
      );
    }
  );

  it('żadna para różnych locale nie współdzieli tagu (pełna macierz, oba scope)', async () => {
    for (const scope of CACHED_SCOPES) {
      const byLocale = new Map<string, string>();
      for (const locale of CANONICAL_LOCALES) {
        byLocale.set(locale, await localeCacheTag(scope, locale));
      }
      const locales = [...byLocale.keys()];
      for (let i = 0; i < locales.length; i++) {
        for (let j = i + 1; j < locales.length; j++) {
          expect(
            byLocale.get(locales[i]),
            `${scope}: ${locales[i]} i ${locales[j]} dzielą tag (cache bleed)`
          ).not.toBe(byLocale.get(locales[j]));
        }
      }
    }
  });

  it('cross-scope: products NIE koliduje z product-categories (żaden wspólny tag)', async () => {
    const productTags = new Set(
      await Promise.all(CANONICAL_LOCALES.map(l => localeCacheTag('products', l)))
    );
    const categoryTags = await Promise.all(
      CANONICAL_LOCALES.map(l => localeCacheTag('product-categories', l))
    );
    for (const ct of categoryTags) {
      expect(productTags.has(ct)).toBe(false);
    }
  });

  // review-fix 1-2-F9: parowanie idzie przez `canonicalFromSlug`, a NIE przez
  // wspólny indeks dwóch niezależnych list SSOT. Poprzedni kształt
  // (`CANONICAL_LOCALES[i]`) miał dwie wady: zmiana kolejności w którejkolwiek
  // liście dawała czerwień bez wskazania przyczyny, a dodanie slugu bez
  // canonical dawało `undefined === undefined` — czyli test PRZECHODZIŁ,
  // maskując 1-2-F2.
  it.each(CACHED_SCOPES)(
    'localeCacheTagForSlug(%s, slug) == localeCacheTag(scope, BCP-47) — jedna konwencja tagów',
    async scope => {
      for (const slug of SUPPORTED_LOCALES) {
        const canonical = canonicalFromSlug(slug);
        expect(canonical, `slug ${slug} nie ma canonical`).toBeTruthy();
        expect(localeCacheTagForSlug(scope, slug)).toBe(await localeCacheTag(scope, canonical));
      }
    }
  );

  // review-fix 1-2-F2/F9: bijekcja SUPPORTED_LOCALES ↔ CANONICAL_LOCALES.
  // Dodanie 5. slugu (`cs`) bez canonical daje `products-undefined` jako tag
  // wspólny dla KAŻDEGO przyszłego slugu bez aliasu — ten test to łapie.
  it('SUPPORTED_LOCALES i CANONICAL_LOCALES są w bijekcji (totalność konwersji)', () => {
    expect(SUPPORTED_LOCALES.length).toBe(CANONICAL_LOCALES.length);

    const mapped = SUPPORTED_LOCALES.map(slug => canonicalFromSlug(slug));

    // Każdy slug ma canonical…
    mapped.forEach((canonical, i) => {
      expect(canonical, `slug ${SUPPORTED_LOCALES[i]} bez canonical`).toBeTruthy();
      expect(CANONICAL_LOCALES).toContain(canonical);
    });

    // …i żadne dwa slugi nie dzielą canonical (inaczej dwa locale = jeden tag).
    expect(new Set(mapped).size).toBe(SUPPORTED_LOCALES.length);
    // …a pokrycie jest pełne w drugą stronę (żaden canonical bez slugu).
    expect(new Set(mapped)).toEqual(new Set(CANONICAL_LOCALES));
  });

  it('localeCacheTagForSlug daje rozłączne tagi per slug (bariera anty-bleed cache scope)', () => {
    const tags = SUPPORTED_LOCALES.flatMap(slug =>
      CACHED_SCOPES.map(scope => localeCacheTagForSlug(scope, slug))
    );
    expect(new Set(tags).size).toBe(SUPPORTED_LOCALES.length * CACHED_SCOPES.length);
  });

  // (v1.14.0 Story 1.2) NOWA BARIERA: klucz `unstable_cache` z locale w
  // argumentach. Guard trzyma dwa zakazy AD-1 naraz:
  //   - `no-store` już nie jest potrzebny (i nie jest barierą),
  //   - `force-cache` + nagłówek NIE MOŻE wrócić (to był dokładnie ten bug).
  it('categories.ts: locale-keyed unstable_cache zamiast force-cache/no-store', () => {
    expect(CATEGORIES_SRC).toContain('createLocaleKeyedCache');
    expect(CATEGORIES_SRC).toContain('StorefrontLocaleSlug');
    // Locale jest JAWNIE wstrzykiwane w cache scope, nie auto-resolvowane.
    expect(CATEGORIES_SRC).toContain('withLocaleHeaderForSlug');
    // REGRESJA, której pilnujemy: powrót do współdzielonego force-cache.
    expect(CATEGORIES_CODE).not.toMatch(cacheModeRegex('force-cache'));
    expect(CATEGORIES_CODE).not.toMatch(cacheModeRegex('no-store'));
  });

  it('products.ts: locale-keyed unstable_cache zamiast force-cache/no-store', () => {
    expect(PRODUCTS_SRC).toContain('createLocaleKeyedCache');
    expect(PRODUCTS_SRC).toContain('StorefrontLocaleSlug');
    expect(PRODUCTS_SRC).toContain('withLocaleHeaderForSlug');
    // Katalogowy odczyt `listProducts` nie może wrócić do współdzielonego
    // force-cache. `no-cache` na innych endpointach (search/filtered) zostaje.
    expect(PRODUCTS_CODE).not.toMatch(cacheModeRegex('force-cache'));
    // Wariant warunkowy (`forceCache ? 'force-cache' : …`) — też z tolerancją
    // whitespace'u i cudzysłowu.
    expect(PRODUCTS_CODE).not.toMatch(/\?\s*['"`]force-cache['"`]\s*:/);
  });

  it('locale-cache.ts: locale jest częścią keyParts ORAZ tagu unstable_cache', () => {
    expect(LOCALE_CACHE_SRC).toContain('unstable_cache');
    // keyParts zawierają locale ⇒ wpisy PL/EN/UA/DE są strukturalnie rozłączne.
    expect(LOCALE_CACHE_SRC).toContain('[keyPrefix, locale]');
    // tag waryjuje po locale ⇒ rewalidacja jednego locale nie zdmuchuje reszty.
    expect(LOCALE_CACHE_SRC).toContain('localeCacheTagForSlug(tagScope, locale)');
  });

  it('product-detail-fetcher.ts: cache() Reacta ZOSTAJE nad unstable_cache, forceCache znika', () => {
    // AD-1: dwie warstwy, nie alternatywy — request-dedupe nad Data Cache.
    expect(PDP_FETCHER_SRC).toContain('cache(async');
    // `forceCache` był mechanizmem force-cache + nagłówek — zakazanym w AD-1.
    expect(PDP_FETCHER_CODE).not.toContain('forceCache');
    // Locale z route'u wchodzi do krotki argumentów (klucz cache() i unstable_cache).
    expect(PDP_FETCHER_SRC).toContain('StorefrontLocaleSlug');
  });

  // (M1 fix) Guard faktycznego mechanizmu lokalizacji POZA cache scope: singleton
  // `sdk` w lib/config.ts MUSI być opakowany w `applyLocaleInterceptor`.
  // Interceptor nie jest już barierą anty-bleed (jest nią klucz `unstable_cache`),
  // ale pozostaje mechanizmem wstrzykiwania locale dla odczytów spoza cache.
  it('lib/config.ts: singleton sdk jest opakowany w applyLocaleInterceptor', () => {
    expect(CONFIG_SRC).toContain('applyLocaleInterceptor');
    // sdk MUSI być eksportem opakowywanym przez interceptor (nie surowym `new Medusa`).
    expect(CONFIG_SRC).toMatch(/export\s+const\s+sdk\s*=\s*applyLocaleInterceptor\s*\(/);
  });

  it('products.ts i categories.ts używają singletonu sdk (przechodzi przez applyLocaleInterceptor)', () => {
    // Oba importują `sdk` z lib/config, co gwarantuje że wszystkie sdk.client.fetch
    // przechodzą przez locale interceptor i wstrzykują x-medusa-locale nagłówek.
    expect(PRODUCTS_SRC).toContain("from '../config'");
    expect(CATEGORIES_SRC).toContain("from '@/lib/config'");
    // Żaden z tych plików nie może używać `new Medusa` (poza-interceptorowy klient).
    expect(PRODUCTS_SRC).not.toContain('new Medusa');
    expect(CATEGORIES_SRC).not.toContain('new Medusa');
  });
});
