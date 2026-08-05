/**
 * Story 2.2 v1.15.0 — AC1 (kontrakt trójstanowy) + AC3 (pusty sukces).
 *
 * Każde z trzech źródeł ma OSOBNY przypadek awarii (nie jeden zbiorczy), bo
 * jeden zbiorczy test przeszedłby, gdyby naprawiono tylko jedno źródło.
 * Kontrola pozytywna (legalnie pusto ⇒ sukces) jest w tym samym pliku celowo:
 * naprawa AC1 bez AC3 wygasza świeży rynek.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const state = {
  categories: null as null | (() => Promise<unknown>),
  sellers: null as null | (() => Promise<unknown>),
  blog: null as null | (() => Promise<unknown>)
};

vi.mock('@/lib/market-locales', () => ({
  resolveMarketLocales: async () => ({
    supported: ['pl', 'en'],
    defaultLocale: 'pl'
  }),
  getMarketDefaultLocale: async () => 'pl'
}));

vi.mock('@/lib/data/categories', () => ({
  listCategories: async () => state.categories!()
}));

vi.mock('@/lib/data/seller', () => ({
  getSellersOrThrow: async () => state.sellers!()
}));

vi.mock('@/lib/blog', () => ({
  fetchHomepageBlogPageDocs: async () => state.blog!(),
  mapPayloadPageToBlogPost: (doc: unknown) => doc
}));

const okCategories = async () => ({ product_categories: [{ handle: 'masaze' }] });
const okSellers = async () => [{ handle: 'city-beauty' }];
const okBlog = async () => [{ slug: 'jak-dbac-o-skore' }];
const boom = (label: string) => async () => {
  throw new Error(`wymuszona awaria: ${label}`);
};

let coldDir: string;

beforeEach(() => {
  // Zimny nośnik: każdy przypadek startuje bez ostatniego dobrego wyniku,
  // chyba że sam go zbuduje.
  coldDir = mkdtempSync(join(tmpdir(), 'sitemap-lastgood-'));
  process.env.GP_SITEMAP_LAST_GOOD_DIR = coldDir;
  state.categories = okCategories;
  state.sellers = okSellers;
  state.blog = okBlog;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(coldDir, { recursive: true, force: true });
  delete process.env.GP_SITEMAP_LAST_GOOD_DIR;
  vi.restoreAllMocks();
});

describe('AC1 — awaria źródła nie może wyprodukować pustej rodziny', () => {
  it('kategorie: awaria bez ostatniego dobrego wyniku RZUCA, nie zwraca sitemapy bez kategorii', async () => {
    const { buildSitemap, readCategories } = await import('./sitemap');
    state.categories = boom('listCategories');

    const read = await readCategories();
    expect(read.status).toBe('failed');
    expect(read.error).toContain('wymuszona awaria: listCategories');

    await expect(buildSitemap()).rejects.toThrow(/categories/);
  });

  it('sprzedawcy: awaria bez ostatniego dobrego wyniku RZUCA', async () => {
    const { buildSitemap, readSellers } = await import('./sitemap');
    state.sellers = boom('getSellers');

    const read = await readSellers();
    expect(read.status).toBe('failed');
    expect(read.items).toEqual([]);
    expect(read.ageSeconds).toBeNull();

    await expect(buildSitemap()).rejects.toThrow(/sellers/);
  });

  it('wpisy bloga: awaria bez ostatniego dobrego wyniku RZUCA', async () => {
    const { buildSitemap, readBlogPosts } = await import('./sitemap');
    state.blog = boom('fetchHomepageBlogPageDocs');

    const read = await readBlogPosts();
    expect(read.status).toBe('failed');

    await expect(buildSitemap()).rejects.toThrow(/blog_posts/);
  });

  it('odpowiedź poza kształtem jest porażką, nie pustką', async () => {
    const { readSellers } = await import('./sitemap');
    state.sellers = async () => ({ sellers: [{ handle: 'x' }] }) as unknown as never;

    const read = await readSellers();
    expect(read.status).toBe('failed');
    expect(read.error).toMatch(/poza kształtem/);
  });
});

describe('AC1 — po udanej generacji awaria serwuje OSTATNI DOBRY WYNIK ze znacznikiem świeżości', () => {
  it('sitemapa nadal zawiera URL-e sprzedawcy i deklaruje status stale + wiek', async () => {
    const { buildSitemap } = await import('./sitemap');

    const fresh = await buildSitemap();
    expect(fresh.freshness.status).toBe('fresh');
    expect(fresh.entries.some(e => e.url.endsWith('/sellers/city-beauty'))).toBe(true);

    state.sellers = boom('getSellers');
    const degraded = await buildSitemap();

    expect(degraded.freshness.status).toBe('stale');
    expect(degraded.freshness.degradedSources).toEqual(['sellers']);
    expect(degraded.freshness.maxAgeSeconds).toBeGreaterThanOrEqual(0);
    expect(degraded.entries.some(e => e.url.endsWith('/sellers/city-beauty'))).toBe(true);
    expect(degraded.familyCounts.seller).toBeGreaterThan(0);
  });

  it('wynik zdegradowany NIE nadpisuje ostatniego dobrego wyniku', async () => {
    const { buildSitemap } = await import('./sitemap');
    const { readLastGood } = await import('./sitemap-last-good');

    await buildSitemap();
    const before = await readLastGood<{ handle: string }>('sellers');

    state.sellers = boom('getSellers');
    await buildSitemap();
    const after = await readLastGood<{ handle: string }>('sellers');

    expect(after).toEqual(before);
  });
});

describe('AC3 — legalnie pusty wynik jest PUSTYM SUKCESEM (kontrola pozytywna)', () => {
  it('rynek bez sprzedawców, kategorii i bloga buduje się bez błędu i nie degraduje', async () => {
    const { buildSitemap } = await import('./sitemap');
    const { getSitemapDegradationMetrics, __resetSitemapDegradationMetricsForTests } =
      await import('./sitemap-degradation');
    __resetSitemapDegradationMetricsForTests();

    state.categories = async () => ({ product_categories: [] });
    state.sellers = async () => [];
    state.blog = async () => [];

    const result = await buildSitemap();

    expect(result.freshness.status).toBe('fresh');
    expect(result.freshness.degradedSources).toEqual([]);
    expect(result.familyCounts.seller).toBe(0);
    expect(result.familyCounts.static).toBeGreaterThan(0);
    expect(result.familyCounts.programmatic_geo_landing).toBeGreaterThan(0);
    expect(getSitemapDegradationMetrics().degradedGenerations).toBe(0);
    expect(getSitemapDegradationMetrics().freshGenerations).toBe(1);
  });

  it('pusty odczyt jest odróżnialny od porażki po polu `status`', async () => {
    const { readSellers } = await import('./sitemap');
    // Kolejność jest istotna: porażka najpierw, na ZIMNYM nośniku — inaczej
    // udany pusty odczyt zapisałby ostatni dobry wynik i porażka byłaby `stale`.
    state.sellers = boom('getSellers');
    const failed = await readSellers();
    expect(failed.status).toBe('failed');
    expect(failed.items).toEqual([]);

    state.sellers = async () => [];
    const empty = await readSellers();
    expect(empty.status).toBe('fresh');
    expect(empty.items).toEqual([]);

    expect(empty.status).not.toBe(failed.status);
  });
});

describe('AC5 — zbiór rynków jest deklarowany, pusty zbiór to odmowa', () => {
  it('wynik budowy niesie zadeklarowany zbiór locale', async () => {
    const { buildSitemap } = await import('./sitemap');
    const result = await buildSitemap();
    expect(result.markets.supported).toEqual(['pl', 'en']);
    expect(result.markets.defaultLocale).toBe('pl');
  });
});
