// Story 7.5 / AC2 / FR8 / ra-3 — regression assert: cross-locale cache bleed fix.
//
// Locale-aware `tags` (localeCacheTag) MUSZĄ dawać rozłączne (disjoint) wartości
// per locale na cache'owanych ścieżkach products/categories, tak że PL/EN/UA/DE
// NIE współdzielą cache'owanej odpowiedzi. Pusta/pominięta asercja = FAIL
// (skip != green). Ta część jest w pełni code/testowalna (nie wymaga żywego stacku).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CANONICAL_LOCALES, localeCacheTag } from '../locale-interceptor';

const CACHED_SCOPES = ['products', 'product-categories'] as const;

const DATA_DIR = resolve(__dirname, '../../data');
const PRODUCTS_SRC = readFileSync(resolve(DATA_DIR, 'products.ts'), 'utf-8');
const CATEGORIES_SRC = readFileSync(resolve(DATA_DIR, 'categories.ts'), 'utf-8');

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

  // Static guard: cache'owane ścieżki MUSZĄ używać locale-aware next.tags —
  // inaczej locale-aware util nie chroni przed bleed (fix = uzupełnienie tagu tam gdzie brak).
  it('products.ts cache force-cache używa localeCacheTag(products) w next.tags', () => {
    expect(PRODUCTS_SRC).toContain("localeCacheTag('products')");
    expect(PRODUCTS_SRC).toContain("force-cache");
  });

  it('categories.ts force-cache używa localeCacheTag(product-categories) w next.tags', () => {
    expect(CATEGORIES_SRC).toContain("localeCacheTag('product-categories')");
    expect(CATEGORIES_SRC).toContain('force-cache');
    // Obie cache'owane ścieżki (listCategories + getCategoryByHandle) otagowane.
    const occurrences = CATEGORIES_SRC.split("localeCacheTag('product-categories')").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
