/**
 * Story 2.2 v1.15.0 — AC5 (AD-21): zbiór ZBUDOWANY vs zbiór SERWOWANY.
 *
 * Jedna asercja na jednym wyniku nie odróżnia warstwy budowy od warstwy
 * serwowania — dlatego każdy test sprawdza OBA zbiory naraz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const marketLocales = { supported: ['pl', 'en'] as string[], defaultLocale: 'pl' };

vi.mock('@/lib/market-locales', () => ({
  resolveMarketLocales: async () => ({
    supported: marketLocales.supported,
    defaultLocale: marketLocales.defaultLocale
  }),
  getMarketDefaultLocale: async () => marketLocales.defaultLocale
}));

vi.mock('@/lib/data/categories', () => ({
  listCategories: async () => ({ product_categories: [{ handle: 'masaze' }] })
}));

vi.mock('@/lib/data/seller', () => ({
  getSellersOrThrow: async () => [{ handle: 'city-beauty' }]
}));

vi.mock('@/lib/blog', () => ({
  fetchHomepageBlogPageDocs: async () => [],
  mapPayloadPageToBlogPost: (doc: unknown) => doc
}));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sitemap-serving-'));
  process.env.GP_SITEMAP_LAST_GOOD_DIR = dir;
  marketLocales.supported = ['pl', 'en'];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.GP_SITEMAP_LAST_GOOD_DIR;
});

describe('AD-21 — wykluczenia stosowane przy serwowaniu, nie przy budowaniu', () => {
  it('trasa noindex JEST w wyniku budowy i NIE MA jej w wyniku serwowania', async () => {
    const { buildSitemap, applyServingExclusions } = await import('./sitemap');

    const built = await buildSitemap();
    const served = applyServingExclusions(built);

    const isRegulamin = (url: string) => /\/(pl|en)\/regulamin$/.test(url);

    expect(built.entries.some(e => isRegulamin(e.url))).toBe(true);
    expect(served.some(e => isRegulamin(e.url))).toBe(false);

    // Trasa nie-wykluczona przeżywa obie warstwy.
    expect(built.entries.some(e => /\/(pl|en)\/sellers$/.test(e.url))).toBe(true);
    expect(served.some(e => /\/(pl|en)\/sellers$/.test(e.url))).toBe(true);

    // Serwowany zbiór jest ŚCISŁYM podzbiorem zbudowanego.
    expect(served.length).toBeLessThan(built.entries.length);
    const builtUrls = new Set(built.entries.map(e => e.url));
    expect(served.every(e => builtUrls.has(e.url))).toBe(true);
  });

  it('polityka wykluczeń jest jawną częścią wyniku budowy (audytowalność)', async () => {
    const { buildSitemap } = await import('./sitemap');
    const built = await buildSitemap();
    expect(built.servingExclusions.noindexStaticSlugs).toEqual(
      expect.arrayContaining(['/regulamin', '/polityka-prywatnosci', '/zasady', '/pomoc'])
    );
  });

  it('wykluczenie nie zjada tras zagnieżdżonych o tym samym prefiksie', async () => {
    const { buildSitemap, applyServingExclusions } = await import('./sitemap');
    const built = await buildSitemap();
    const served = applyServingExclusions(built);
    expect(served.some(e => e.url.endsWith('/categories/masaze'))).toBe(true);
  });

  it('pusty zadeklarowany zbiór rynków jest ODMOWĄ (błąd), nie „wszystkim"', async () => {
    const { buildSitemap } = await import('./sitemap');
    marketLocales.supported = [];
    await expect(buildSitemap()).rejects.toThrow(/AD-21|zadeklarow/);
  });
});
