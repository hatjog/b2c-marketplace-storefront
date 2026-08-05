/**
 * KONTROLA POZYTYWNA dla AC3 — Story 2.2 v1.15.0, dopisana po review [MEDIUM].
 *
 * DLACZEGO OSOBNY PLIK, A NIE KOLEJNY PRZYPADEK W `sitemap-failure-contract`:
 * tamten test asertuje `freshness` i `getSitemapDegradationMetrics()`, czyli
 * API WPROWADZONE PRZEZ TĘ STORY — nie mógł być zielony przed zmianą i dlatego
 * nie pełnił roli, dla której AC3 go wymagało (niezależne zabezpieczenie przed
 * „naprawą, która wysadza świeży rynek"). Był kolejnym testem nowego kodu.
 *
 * Ten test jest wyrażony WYŁĄCZNIE w kategoriach NIEZMIENNYCH wobec refaktoru:
 *   - wchodzi przez ścieżkę SERWOWANIA (`src/app/sitemap.ts`), nie przez
 *     wewnętrzne API modułu,
 *   - nie zna pojęć `freshness`, `status`, `familyCounts` ani licznika,
 *   - mockuje warstwę danych pod OBIEMA nazwami (`getSellers`
 *     i `getSellersOrThrow`), więc przechodzi na wariancie sprzed zmiany
 *     i po niej.
 *
 * Kontrakt, którego strzeże: rynek LEGALNIE PUSTY (bez sprzedawców, kategorii
 * i wpisów bloga) dostaje sitemapę z trasami statycznymi i landingami
 * programatycznymi — a nie wyjątek i nie pustą kolekcję. To jest ten test,
 * którego nie wolno złamać przy zaostrzaniu fail-closed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@/lib/market-locales', () => ({
  resolveMarketLocales: async () => ({ supported: ['pl', 'en'], defaultLocale: 'pl' }),
  getMarketDefaultLocale: async () => 'pl'
}));

// Rynek legalnie pusty — każde źródło ODPOWIADA POPRAWNIE i zwraca zero pozycji.
vi.mock('@/lib/data/categories', () => ({
  listCategories: async () => ({ product_categories: [] })
}));

vi.mock('@/lib/data/seller', () => ({
  getSellers: async () => [],
  getSellersOrThrow: async () => []
}));

vi.mock('@/lib/blog', () => ({
  fetchHomepageBlogPageDocs: async () => [],
  mapPayloadPageToBlogPost: (doc: unknown) => doc
}));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sitemap-empty-market-'));
  process.env.GP_SITEMAP_LAST_GOOD_DIR = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.GP_SITEMAP_LAST_GOOD_DIR;
});

describe('AC3 kontrola pozytywna — legalnie pusty rynek jest SUKCESEM na ścieżce serwowania', () => {
  it('rynek bez sprzedawców, kategorii i bloga dostaje sitemapę, nie wyjątek', async () => {
    const { default: sitemap } = await import('../sitemap');

    const served = await sitemap();

    expect(Array.isArray(served)).toBe(true);
    expect(served.length).toBeGreaterThan(0);

    // Rodzina `static` — strona główna każdego zadeklarowanego locale.
    expect(served.some(e => /\/pl$/.test(e.url))).toBe(true);
    expect(served.some(e => /\/en$/.test(e.url))).toBe(true);

    // Rodzina `programmatic_geo_landing` — nie zależy od żadnego źródła zdalnego.
    expect(served.some(e => e.url.includes('/l/'))).toBe(true);

    // Rodziny zależne od pustych źródeł są puste — i to jest poprawne.
    expect(served.some(e => e.url.includes('/sellers/'))).toBe(false);
    expect(served.some(e => e.url.includes('/categories/'))).toBe(false);
    expect(served.some(e => e.url.includes('/blog/'))).toBe(false);
  });
});
