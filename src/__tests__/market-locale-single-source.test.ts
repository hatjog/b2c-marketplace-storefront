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

afterEach(() => {
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
  });

  it('hreflang alternates stop emitting uk-UA / de-DE entries', async () => {
    await stubNarrowedMarket();
    const { buildLocaleAlternates } = await import('@/lib/seo/hreflang');

    const alt = await buildLocaleAlternates('pl', loc => `/${loc}/categories`, 'https://x.example');
    expect(Object.keys(alt.languages).sort()).toEqual(['en-US', 'pl-PL', 'x-default'].sort());
  });

  it('sitemap emits URLs only for the market locales', async () => {
    await stubNarrowedMarket();
    const { buildSitemap } = await import('@/lib/seo/sitemap');

    const { entries } = await buildSitemap();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/(ua|de)(\/|$)/);
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual(['en', 'pl', 'x-default'].sort());
    }
  });
});
