// Story 7.5 / AC2 / FR8 / ra-3 — regression assert: cross-locale cache bleed fix.
//
// Locale-aware `tags` (localeCacheTag) MUSZĄ dawać rozłączne (disjoint) wartości
// per locale na cache'owanych ścieżkach products/categories, tak że PL/EN/UA/DE
// NIE współdzielą cache'owanej odpowiedzi. Pusta/pominięta asercja = FAIL
// (skip != green). Ta część jest w pełni code/testowalna (nie wymaga żywego stacku).
//
// MECHANIZM IZOLACJI (v1.12.0 UA-loc — KOREKTA wcześniejszego błędnego założenia):
//   `x-medusa-locale` (wstrzykiwany przez `applyLocaleInterceptor` na singletonie `sdk`)
//   zapewnia, że backend ZWRACA właściwy locale, ale Next.js Data Cache NIE wlicza
//   nagłówków żądania do klucza — więc wspólny `force-cache` na tym samym URL kolidował
//   między locale (bug znaleziony live: PL→UA). Faktyczna izolacja katalogowych odczytów =
//   `no-store` (brak wspólnego wpisu). localeCacheTag pozostaje eksportowanym util do
//   granularnej rewalidacji, ale NIE jest barierą anty-bleed dla products/categories.
// Ten plik asercjonuje: (a) localeCacheTag daje rozłączne tagi (util), (b) katalogowe
// odczyty są no-store (anty-bleed), (c) singleton sdk przechodzi przez interceptor.
// Testy `locale-interceptor.test.ts` pokrywają faktyczne działanie header injection.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CANONICAL_LOCALES, localeCacheTag } from '../locale-interceptor';

const CACHED_SCOPES = ['products', 'product-categories'] as const;

const DATA_DIR = resolve(__dirname, '../../data');
const PRODUCTS_SRC = readFileSync(resolve(DATA_DIR, 'products.ts'), 'utf-8');
const CATEGORIES_SRC = readFileSync(resolve(DATA_DIR, 'categories.ts'), 'utf-8');
const CONFIG_SRC = readFileSync(resolve(__dirname, '../../config.ts'), 'utf-8');

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

  // (v1.12.0 UA-loc CORRECTION) Pierwotne założenie tego pliku (że nagłówek
  // x-medusa-locale partycjonuje Next.js Data Cache per-locale) jest BŁĘDNE: Next NIE
  // wlicza nagłówków żądania do klucza Data Cache. Wspólny `force-cache` na tym samym
  // URL kolidował między locale (pierwszy pobrany locale leakował do reszty — PL→UA).
  // FIX: katalogowe odczyty (products/categories) używają `no-store` — brak wspólnego
  // wpisu cache = brak bleed. localeCacheTag pozostaje util (rewalidacja), ale NIE jest
  // już barierą anty-bleed dla tych ścieżek. Guard: te ścieżki NIE mogą wrócić do
  // współdzielonego force-cache (regresja bleed). Locale-keyed cache = follow-up perf.
  it('categories.ts katalogowe odczyty są no-store (NIE współdzielony force-cache → brak cross-locale bleed)', () => {
    expect(CATEGORIES_SRC).toContain("cache: 'no-store'");
    expect(CATEGORIES_SRC).not.toContain("cache: 'force-cache'");
  });

  it('products.ts katalogowy odczyt jest no-store (NIE współdzielony force-cache → brak cross-locale bleed)', () => {
    expect(PRODUCTS_SRC).toContain("cache: 'no-store'");
    expect(PRODUCTS_SRC).not.toContain("cache: 'force-cache'");
    expect(PRODUCTS_SRC).not.toContain("? 'force-cache' :");
  });

  // (M1 fix) Guard faktycznego mechanizmu cache izolacji: singleton `sdk` w lib/config.ts
  // MUSI być opakowany w `applyLocaleInterceptor`. Bez tego interceptora nagłówek
  // `x-medusa-locale` nie byłby wstrzykiwany i Next.js Data Cache nie partycjonowałby
  // odpowiedzi per-locale (URL + nagłówki = klucz cache; sam tag = tylko granularność
  // rewalidacji). Regression assert: usunięcie `applyLocaleInterceptor` z config.ts
  // złamałoby ten guard zanim złamałby cokolwiek innego.
  it('lib/config.ts: singleton sdk jest opakowany w applyLocaleInterceptor (faktyczny mechanizm anty-bleed)', () => {
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
