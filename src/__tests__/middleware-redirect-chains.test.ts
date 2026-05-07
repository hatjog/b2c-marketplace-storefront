import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '@/middleware';

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
  }

  it('regression guard: /de/salony does NOT produce 307 (chain was eliminated)', async () => {
    const res = await middleware(makeReq(`${BASE}/de/salony`));
    // Before fix: would be 301 (chain start); locale-redirect then emitted 307 for /de/sellers
    // After fix: 308 direct, no second hop
    expect(res.status).not.toBe(307);
    expect(res.status).toBe(308);
  });

  it('regression guard: /ua/salony does NOT produce 307', async () => {
    const res = await middleware(makeReq(`${BASE}/ua/salony`));
    expect(res.status).not.toBe(307);
    expect(res.status).toBe(308);
  });
});
