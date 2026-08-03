/**
 * Story 1.4 v1.14.0 AC4 — trzeci sygnał SEO z ADR-153 pkt 3 (sitemap-exclude).
 *
 * Rozstrzygnięcie: sitemap-exclude dla PDP poniżej progu jakości jest
 * spełniony KONSTRUKCYJNIE — `buildSitemap` publikuje pięć rodzin route'ów
 * (`static`, `category`, `seller`, `blog_post`, `programmatic_geo_landing`)
 * i nie emituje PDP w ogóle, więc „PDP poniżej progu" nie może trafić do
 * sitemapy.
 *
 * To NIE jest ciche pominięcie: bez tego testu dodanie rodziny `product`
 * w przyszłości po cichu unieważniłoby rozstrzygnięcie AC4 (PDP z
 * `content_bar[locale].bar === false` trafiłby do sitemapy przy jednoczesnym
 * `noindex` — dokładnie ta niespójność sygnałów, którą ADR-153 odrzuca).
 * Gdy taka rodzina powstanie, MUSI filtrować po `content_bar`, a ten test
 * trzeba świadomie przepiąć na filtr, nie usunąć.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/market-locales', () => ({
  resolveMarketLocales: async () => ({
    supported: ['pl', 'en', 'ua', 'de'],
    defaultLocale: 'pl'
  })
}));

vi.mock('@/lib/data/categories', () => ({
  listCategories: async () => ({ product_categories: [{ handle: 'masaze' }] })
}));

vi.mock('@/lib/data/seller', () => ({
  getSellers: async () => ({ sellers: [{ handle: 'city-beauty' }] })
}));

vi.mock('@/lib/blog', () => ({
  fetchHomepageBlogPageDocs: async () => [],
  mapPayloadPageToBlogPost: (doc: unknown) => doc
}));

const { buildSitemap } = await import('./sitemap');

describe('AC4 — sitemap nie publikuje PDP (rozstrzygnięcie ADR-153 pkt 3)', () => {
  it('familyCounts nie zawiera rodziny `product`', async () => {
    const { familyCounts } = await buildSitemap();

    expect(Object.keys(familyCounts).sort()).toEqual([
      'blog_post',
      'category',
      'programmatic_geo_landing',
      'seller',
      'static'
    ]);
    expect(familyCounts).not.toHaveProperty('product');
  });

  it('żaden wpis sitemapy nie wskazuje na /<locale>/products/<handle>', async () => {
    const { entries } = await buildSitemap();

    const pdpEntries = entries.filter(entry => /\/products\/[^/]+$/.test(entry.url));
    expect(pdpEntries).toEqual([]);
  });
});
