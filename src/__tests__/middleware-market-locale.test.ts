import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Story 1.1 v1.14.0 (FR-4, HG-7; AD-2) — middleware market-locale classes:
 *   (1) locale supported by the market      → no redirect
 *   (2) platform locale NOT market-supported → 307 to `locales.default`
 *   (3) slug outside the platform (/fr)      → legacy 307 per resolveLang (ratified)
 * Assertions check the exact status code 307 (not 301/308) so a market
 * `locales` change never gets baked into browser caches.
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

const BASE = 'http://localhost:3000';

async function createConfigRoot(locales: { default: string; supported: string[] }) {
  const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-middleware-market-'));
  const marketRoot = path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty');
  await fs.mkdir(marketRoot, { recursive: true });
  await fs.writeFile(
    path.join(marketRoot, 'market.yaml'),
    [
      'market_id: bonbeauty',
      'locales:',
      `  default: ${locales.default}`,
      `  supported: [${locales.supported.join(', ')}]`,
      ''
    ].join('\n'),
    'utf8'
  );
  return configRoot;
}

async function importMiddleware(configRoot: string) {
  vi.stubEnv('GP_CONFIG_ROOT', configRoot);
  vi.stubEnv('GP_INSTANCE_ID', 'gp-dev');
  vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', 'bonbeauty');
  vi.resetModules();
  const { middleware } = await import('@/middleware');
  return middleware;
}

function makeReq(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe('class 1 — market-supported locale passes without redirect', () => {
  it('lets /pl /en /ua /de through for the current bonbeauty config (supported = all 4)', async () => {
    const configRoot = await createConfigRoot({
      default: 'pl',
      supported: ['pl', 'en', 'ua', 'de']
    });
    const middleware = await importMiddleware(configRoot);

    for (const locale of ['pl', 'en', 'ua', 'de']) {
      const res = await middleware(makeReq(`${BASE}/${locale}/categories`));
      expect(res.status, `/${locale} must not redirect`).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
  });
});

describe('class 2 — platform locale not supported by the market → 307 to locales.default', () => {
  it('redirects /de to /pl with path and query preserved when market supports [pl,en,ua]', async () => {
    const configRoot = await createConfigRoot({ default: 'pl', supported: ['pl', 'en', 'ua'] });
    const middleware = await importMiddleware(configRoot);

    const res = await middleware(makeReq(`${BASE}/de/products/serum-01?a=1&b=2`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/pl/products/serum-01?a=1&b=2`);
  });

  it('redirects the bare /de root to the market default', async () => {
    const configRoot = await createConfigRoot({ default: 'pl', supported: ['pl', 'en', 'ua'] });
    const middleware = await importMiddleware(configRoot);

    const res = await middleware(makeReq(`${BASE}/de`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/pl`);
  });

  it('targets locales.default (not supported[0]) — default en, supported [pl, en]', async () => {
    const configRoot = await createConfigRoot({ default: 'en', supported: ['pl', 'en'] });
    const middleware = await importMiddleware(configRoot);

    const res = await middleware(makeReq(`${BASE}/ua/cart`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/en/cart`);
  });

  it('uses 307 — NOT 301/308 — and updates the _gp_lang cookie to the default', async () => {
    const configRoot = await createConfigRoot({ default: 'pl', supported: ['pl', 'en', 'ua'] });
    const middleware = await importMiddleware(configRoot);

    const res = await middleware(makeReq(`${BASE}/de/categories`));
    expect(res.status).toBe(307);
    expect([301, 308]).not.toContain(res.status);
    expect(res.headers.get('set-cookie')).toContain('_gp_lang=pl');
  });
});

describe('class 3 — slug outside the platform → legacy 307 per resolveLang (ratified, untouched)', () => {
  it('redirects /fr per resolveLang default without consulting market config', async () => {
    const configRoot = await createConfigRoot({ default: 'pl', supported: ['pl', 'en', 'ua'] });
    const middleware = await importMiddleware(configRoot);

    const res = await middleware(makeReq(`${BASE}/fr`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${BASE}/pl/fr`);
  });
});

describe('fail-fast — missing locales block breaks platform-locale requests loudly', () => {
  it('rejects instead of silently serving the platform superset', async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-middleware-market-empty-'));
    const marketRoot = path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty');
    await fs.mkdir(marketRoot, { recursive: true });
    await fs.writeFile(path.join(marketRoot, 'market.yaml'), 'market_id: bonbeauty\n', 'utf8');
    const middleware = await importMiddleware(configRoot);

    await expect(middleware(makeReq(`${BASE}/pl`))).rejects.toThrowError(
      /locales block is missing/
    );
  });
});
