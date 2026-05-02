import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '@/middleware';

/**
 * Story v160-3-2: 301 permanent redirect /[locale]/salony/* → /[locale]/sellers/*
 *
 * Covers AC2-AC5 (redirect cases) + boundary edge case (`salonyzz` no-match).
 * Middleware redirect rule fires BEFORE resolveLang/auth-guard logic per Story 3.2 design.
 */

function makeReq(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe('Story 3.2 — /[locale]/salony/* → 301 → /[locale]/sellers/*', () => {
  it('AC2: /pl/salony → 301 → /pl/sellers', async () => {
    const res = await middleware(makeReq('http://localhost:3000/pl/salony'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('http://localhost:3000/pl/sellers');
  });

  it('AC3: /pl/salony/test-handle → 301 → /pl/sellers/test-handle', async () => {
    const res = await middleware(
      makeReq('http://localhost:3000/pl/salony/test-handle')
    );
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/pl/sellers/test-handle'
    );
  });

  it('AC4: /pl/salony?q=fryzjer&city=Warszawa → 301 z preserved query', async () => {
    const res = await middleware(
      makeReq('http://localhost:3000/pl/salony?q=fryzjer&city=Warszawa')
    );
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/pl/sellers?q=fryzjer&city=Warszawa'
    );
  });

  it('AC4 combined: /pl/salony/salon-pieknosci?ref=campaign-x → 301 z handle + params', async () => {
    const res = await middleware(
      makeReq(
        'http://localhost:3000/pl/salony/salon-pieknosci?ref=campaign-x'
      )
    );
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/pl/sellers/salon-pieknosci?ref=campaign-x'
    );
  });

  it('AC5: /en/salony → 301 → /en/sellers (locale preserved)', async () => {
    const res = await middleware(makeReq('http://localhost:3000/en/salony'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en/sellers');
  });

  it('Boundary: /pl/salonyzz → NIE 301 (regex word boundary)', async () => {
    const res = await middleware(makeReq('http://localhost:3000/pl/salonyzz'));
    // Should NOT be 301 redirect to /pl/sellerszz — falls through to normal flow
    if (res.status === 301) {
      const location = res.headers.get('location') ?? '';
      expect(location).not.toContain('/pl/sellers');
    }
    // Normal flow returns 200 (NextResponse.next) or other non-redirect for supported locale
    // We only assert: brak salony→sellers transformation
  });
});
