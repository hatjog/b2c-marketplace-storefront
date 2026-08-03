import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '@/middleware';

// Story 1.1 v1.14.0: middleware consults the market-aware locale resolver, so
// tests point GP_CONFIG_ROOT at the bonbeauty fixture (all 4 platform locales
// supported — pre-existing expectations in this file stay unchanged).
process.env.GP_CONFIG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../tests/fixtures/market-config'
);
process.env.GP_INSTANCE_ID = 'gp-dev';
process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = 'bonbeauty';

/**
 * Story v160-3-2 + cleanup-19: 308 permanent redirect /[locale]/salony/* → /[locale]/sellers/*
 *
 * Covers AC2-AC5 (redirect cases) + boundary edge case (`salonyzz` no-match).
 * Middleware redirect rule fires BEFORE resolveLang/auth-guard logic per Story 3.2 design.
 *
 * cleanup-19: changed 301 → 308 to prevent 301→307 redirect chain.
 * With SUPPORTED_LOCALES = ['pl','en','ua','de'], ua/de locales no longer trigger the
 * !isSupportedLocale branch after the salony redirect — eliminating the chain entirely.
 * 308 (Permanent Redirect, method-preserving) is the correct status for this use case.
 */

function makeReq(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe('Story 3.2 + cleanup-19 — /[locale]/salony/* → 308 → /[locale]/sellers/*', () => {
  it('AC2: /pl/salony → 308 → /pl/sellers', async () => {
    const res = await middleware(makeReq('http://localhost:3000/pl/salony'));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://localhost:3000/pl/sellers');
  });

  it('AC3: /pl/salony/test-handle → 308 → /pl/sellers/test-handle', async () => {
    const res = await middleware(
      makeReq('http://localhost:3000/pl/salony/test-handle')
    );
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/pl/sellers/test-handle'
    );
  });

  it('AC4: /pl/salony?q=fryzjer&city=Warszawa → 308 z preserved query', async () => {
    const res = await middleware(
      makeReq('http://localhost:3000/pl/salony?q=fryzjer&city=Warszawa')
    );
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/pl/sellers?q=fryzjer&city=Warszawa'
    );
  });

  it('AC4 combined: /pl/salony/salon-pieknosci?ref=campaign-x → 308 z handle + params', async () => {
    const res = await middleware(
      makeReq(
        'http://localhost:3000/pl/salony/salon-pieknosci?ref=campaign-x'
      )
    );
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/pl/sellers/salon-pieknosci?ref=campaign-x'
    );
  });

  it('AC5: /en/salony → 308 → /en/sellers (locale preserved)', async () => {
    const res = await middleware(makeReq('http://localhost:3000/en/salony'));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en/sellers');
  });

  it('Boundary: /pl/salonyzz → NIE 308 (regex word boundary)', async () => {
    const res = await middleware(makeReq('http://localhost:3000/pl/salonyzz'));
    // Should NOT be 308 redirect to /pl/sellerszz — falls through to normal flow
    if (res.status === 308) {
      const location = res.headers.get('location') ?? '';
      expect(location).not.toContain('/pl/sellers');
    }
    // Normal flow returns 200 (NextResponse.next) or other non-redirect for supported locale
    // We only assert: brak salony→sellers transformation
  });
});
