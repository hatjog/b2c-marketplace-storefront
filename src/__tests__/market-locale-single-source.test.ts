import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Story 1.1 v1.14.0 AC3 single-source proof: narrowing `locales.supported` in
 * ONE fixture (market.yaml) moves middleware, hreflang alternates and the
 * sitemap at once — no surface keeps a second locale list.
 */

const ORIGINAL_ENV = {
  GP_CONFIG_ROOT: process.env.GP_CONFIG_ROOT,
  GP_INSTANCE_ID: process.env.GP_INSTANCE_ID,
  NEXT_PUBLIC_PAYLOAD_MARKET_ID: process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID
};

// Cold dynamic imports of `@/middleware` / `@/lib/data/cart`-sized module graphs
// exceed vitest's 5 s default when the whole suite runs in parallel (measured
// 5.0-5.9 s, DW-15-326). The budget covers module loading, not the assertions.
const COLD_IMPORT_TIMEOUT_MS = 30_000;

afterEach(() => {
  vi.doUnmock('@/lib/data/categories');
  vi.doUnmock('@/lib/data/seller');
  vi.doUnmock('@/lib/blog');
  vi.resetModules();
  vi.unstubAllEnvs();

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function stubNarrowedMarket() {
  const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-single-source-'));
  const marketRoot = path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty');
  await fs.mkdir(marketRoot, { recursive: true });
  await fs.writeFile(
    path.join(marketRoot, 'market.yaml'),
    ['market_id: bonbeauty', 'locales:', '  default: pl', '  supported: [pl, en]', ''].join('\n'),
    'utf8'
  );

  vi.stubEnv('GP_CONFIG_ROOT', configRoot);
  vi.stubEnv('GP_INSTANCE_ID', 'gp-dev');
  vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', 'bonbeauty');
  vi.resetModules();
}

describe('single fixture narrowed to [pl, en] moves every surface at once', () => {
  it('middleware starts redirecting /ua and /de to the default', async () => {
    await stubNarrowedMarket();
    const { middleware } = await import('@/middleware');

    for (const dropped of ['ua', 'de']) {
      const res = await middleware(new NextRequest(new URL(`http://localhost:3000/${dropped}`)));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/pl');
    }

    const kept = await middleware(new NextRequest(new URL('http://localhost:3000/en')));
    expect(kept.status).toBe(200);
  }, COLD_IMPORT_TIMEOUT_MS);

  it('hreflang alternates stop emitting uk-UA / de-DE entries', async () => {
    await stubNarrowedMarket();
    const { buildLocaleAlternates } = await import('@/lib/seo/hreflang');

    const alt = await buildLocaleAlternates('pl', loc => `/${loc}/categories`, 'https://x.example');
    expect(Object.keys(alt.languages).sort()).toEqual(['en-US', 'pl-PL', 'x-default'].sort());
  }, COLD_IMPORT_TIMEOUT_MS);

  it('sitemap emits URLs only for the market locales', async () => {
    await stubNarrowedMarket();
    // DW-15-326: since AD-19 (a117d1164) the sitemap is fail-closed — a source
    // that cannot be read makes `buildSitemap()` throw. Without a backend the
    // three live reads hung or failed, so this test could never reach its
    // locale assertions. The data sources are stubbed (same shape as
    // sitemap-failure-contract.test.ts); the locale set still comes from the
    // narrowed market.yaml fixture, which is what this test proves.
    vi.stubEnv(
      'GP_SITEMAP_LAST_GOOD_DIR',
      await fs.mkdtemp(path.join(os.tmpdir(), 'gp-single-source-lastgood-'))
    );
    vi.doMock('@/lib/data/categories', () => ({
      listCategories: async () => ({ product_categories: [{ handle: 'masaze' }] })
    }));
    vi.doMock('@/lib/data/seller', () => ({
      getSellersOrThrow: async () => [{ handle: 'city-beauty' }]
    }));
    vi.doMock('@/lib/blog', () => ({
      fetchHomepageBlogPageDocs: async () => [{ slug: 'jak-dbac-o-skore' }]
    }));
    const { buildSitemap } = await import('@/lib/seo/sitemap');

    const { entries } = await buildSitemap();
    expect(entries.length).toBeGreaterThan(0);
    // Every dynamic family is present, so the locale check below covers them too.
    for (const family of ['/categories/masaze', '/sellers/city-beauty', '/blog/jak-dbac-o-skore']) {
      expect(entries.some(entry => entry.url.endsWith(`/pl${family}`))).toBe(true);
      expect(entries.some(entry => entry.url.endsWith(`/en${family}`))).toBe(true);
    }
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/(ua|de)(\/|$)/);
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual(['en', 'pl', 'x-default'].sort());
    }
  }, COLD_IMPORT_TIMEOUT_MS);
});
