import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '@/middleware';

// Story 1.1 v1.14.0: middleware consults the market-aware locale resolver, so
// tests point GP_CONFIG_ROOT at the bonbeauty fixture (all 4 platform locales
// supported — pre-existing expectations in this file stay unchanged).
const FIXTURE_CONFIG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../tests/fixtures/market-config'
);
process.env.GP_CONFIG_ROOT = FIXTURE_CONFIG_ROOT;
process.env.GP_INSTANCE_ID = 'gp-dev';
process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = 'bonbeauty';

/**
 * Story v160-cleanup-19 — Chain-detection test (AC5 + AC6)
 *
 * Asserts that /[locale]/salony produces a SINGLE 308 redirect (no chain).
 *
 * Root cause of the 301→307 chain (pre-fix):
 *   1. SALONY_REDIRECT_RE matched /[locale]/salony → 301 to /[locale]/sellers
 *   2. For unsupported locales (ua, de), the 301 target URL /[locale]/sellers would
 *      then hit the !isSupportedLocale branch → another 307 redirect
 *   → result: 301→307 two-hop chain
 *
 * Fix (cleanup-19):
 *   - SUPPORTED_LOCALES extended to ['pl','en','ua','de']: ua/de no longer unsupported
 *   - Redirect status changed 301→308: avoids residual chain interaction
 *
 * This test WILL FAIL if:
 *   - A locale is removed from SUPPORTED_LOCALES and the chain reappears
 *   - The redirect status is downgraded back to 301 AND another middleware branch
 *     re-triggers for the same request
 *
 * Regression guard: each path must produce status 308, with Location pointing
 * directly to /[locale]/sellers (no intermediate hop).
 */

function makeReq(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

const BASE = 'http://localhost:3000';

/**
 * Helper: follow up to N redirect hops by re-invoking middleware on the
 * Location header. Returns the full chain of (status, location) tuples plus
 * the terminal response. A "chain" exists when more than one hop occurs.
 */
async function followRedirects(
  startUrl: string,
  maxHops: number = 5
): Promise<{ hops: Array<{ status: number; location: string | null }>; final: Response }> {
  const hops: Array<{ status: number; location: string | null }> = [];
  let currentUrl = startUrl;
  let res: Response | undefined;

  for (let i = 0; i < maxHops; i++) {
    res = await middleware(makeReq(currentUrl));
    const status = res.status;
    const location = res.headers.get('location');
    if (status >= 300 && status < 400 && location) {
      hops.push({ status, location });
      currentUrl = location;
      continue;
    }
    break;
  }

  if (!res) {
    throw new Error('middleware never produced a response');
  }
  return { hops, final: res };
}

describe('cleanup-19 — chain-detection: /[locale]/salony → single-hop 308', () => {
  const locales = ['pl', 'en', 'ua', 'de'] as const;

  for (const locale of locales) {
    it(`/${locale}/salony → single 308 (no chain) — locale ${locale}`, async () => {
      const res = await middleware(makeReq(`${BASE}/${locale}/salony`));

      // MUST be exactly 308 — not 301 (chain source), not 307 (chain continuation)
      expect(res.status).toBe(308);

      // Location MUST point directly to canonical /${locale}/sellers (single hop)
      const location = res.headers.get('location');
      expect(location).toBe(`${BASE}/${locale}/sellers`);
    });

    it(`/${locale}/salony/beauty-slug → single 308 with suffix preserved`, async () => {
      const res = await middleware(
        makeReq(`${BASE}/${locale}/salony/beauty-slug`)
      );

      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe(
        `${BASE}/${locale}/sellers/beauty-slug`
      );
    });

    it(`/${locale}/salony → exactly ONE redirect hop (no 301→307 chain)`, async () => {
      // True chain detection: re-invoke middleware on the redirect target and
      // assert the second invocation does NOT issue another redirect.
      const { hops } = await followRedirects(`${BASE}/${locale}/salony`);
      // Exactly one hop = single 308; >1 = chain regression
      expect(hops.length).toBe(1);
      expect(hops[0]?.status).toBe(308);
      expect(hops[0]?.location).toBe(`${BASE}/${locale}/sellers`);
    });
  }

  it('regression guard: /de/salony resolves in single hop, no second redirect', async () => {
    const { hops } = await followRedirects(`${BASE}/de/salony`);
    // Pre-fix: 2 hops (301 to /de/sellers, then 307 because de unsupported).
    // Post-fix: 1 hop (308 direct, second invocation on /de/sellers passes through).
    expect(hops.length).toBe(1);
    expect(hops[0]?.status).toBe(308);
  });

  it('regression guard: /ua/salony resolves in single hop, no second redirect', async () => {
    const { hops } = await followRedirects(`${BASE}/ua/salony`);
    expect(hops.length).toBe(1);
    expect(hops[0]?.status).toBe(308);
  });
});
