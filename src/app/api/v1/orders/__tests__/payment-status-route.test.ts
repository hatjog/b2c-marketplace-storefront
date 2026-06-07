import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';

import { isAllowedOrigin } from '../[id]/payment-status/origin-guard';

function requestWithHeaders(headers: Record<string, string>) {
  return {
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe('/api/v1/orders/[id]/payment-status origin guard', () => {
  it('allows same-origin server-side reads without Origin/Referer', () => {
    expect(isAllowedOrigin(requestWithHeaders({}))).toBe(true);
  });

  it('allows configured storefront origin', () => {
    process.env.NEXT_PUBLIC_STOREFRONT_URL = 'https://shop.example.test';

    expect(
      isAllowedOrigin(requestWithHeaders({ origin: 'https://shop.example.test' })),
    ).toBe(true);

    delete process.env.NEXT_PUBLIC_STOREFRONT_URL;
  });

  it('rejects cross-origin reads when storefront origin is configured', () => {
    process.env.NEXT_PUBLIC_STOREFRONT_URL = 'https://shop.example.test';

    expect(
      isAllowedOrigin(requestWithHeaders({ origin: 'https://evil.example.test' })),
    ).toBe(false);

    delete process.env.NEXT_PUBLIC_STOREFRONT_URL;
  });

  it('rejects malformed referer values', () => {
    expect(isAllowedOrigin(requestWithHeaders({ referer: 'not a url' }))).toBe(false);
  });
});
