import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { isAllowedOrigin } from '../[id]/payment-status/origin-guard';

const cookieJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

vi.mock('@/lib/env', () => ({
  resolveMedusaBackendUrl: () => 'http://backend.test',
}));

vi.mock('@/lib/data/cookies', () => ({
  getCompletedCartId: async () => cookieJar.get('_gp_completed_cart'),
}));

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

describe('/api/v1/orders/[id]/payment-status guest proof forwarding', () => {
  const okBody = {
    status: 'paid',
    last_checked_at: '2026-07-27T18:00:00.000Z',
    recommended_action_key: 'continue',
  };

  function request() {
    return { headers: new Headers() } as unknown as NextRequest;
  }

  function context(id = 'order_1') {
    return { params: Promise.resolve({ id }) };
  }

  function okResponse() {
    return { ok: true, status: 200, json: async () => okBody } as Response;
  }

  function deniedResponse(status: number) {
    return { ok: false, status, json: async () => ({}) } as Response;
  }

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cookieJar.clear();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('dokłada cart_id z cookie, gdy nie ma sesji klienta', async () => {
    cookieJar.set('_gp_completed_cart', 'cart_1');
    fetchSpy.mockResolvedValue(okResponse());

    const { GET } = await import('../[id]/payment-status/route');
    const res = await GET(request(), context());

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'http://backend.test/store/orders/order_1/payment-status?cart_id=cart_1',
    );
  });

  it('nie dokłada dowodu, gdy sesja klienta działa', async () => {
    cookieJar.set('_medusa_jwt', 'jwt_ok');
    cookieJar.set('_gp_completed_cart', 'cart_1');
    fetchSpy.mockResolvedValue(okResponse());

    const { GET } = await import('../[id]/payment-status/route');
    await GET(request(), context());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).not.toContain('cart_id');
  });

  it('ponawia dowodem z cookie, gdy sesja wygasła (401 z JWT)', async () => {
    cookieJar.set('_medusa_jwt', 'jwt_stale');
    cookieJar.set('_gp_completed_cart', 'cart_1');
    fetchSpy.mockResolvedValueOnce(deniedResponse(401)).mockResolvedValueOnce(okResponse());

    const { GET } = await import('../[id]/payment-status/route');
    const res = await GET(request(), context());

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toContain('cart_id=cart_1');
    // Retry idzie BEZ nagłówka autoryzacji — inaczej backend odbiłby go ponownie.
    expect((fetchSpy.mock.calls[1][1] as RequestInit).headers).not.toHaveProperty('authorization');
  });

  it('ponawia dowodem także na 404 — zalogowana kupująca z zamówieniem gościa', async () => {
    // Backend dla ważnej sesji, która nie jest właścicielem, oddaje 404
    // (nie zdradza istnienia zamówienia). Bez tego retry dowód z cookie
    // nigdy nie zostałby użyty i kupująca widziałaby „nie znaleziono".
    cookieJar.set('_medusa_jwt', 'jwt_innego_konta');
    cookieJar.set('_gp_completed_cart', 'cart_1');
    fetchSpy.mockResolvedValueOnce(deniedResponse(404)).mockResolvedValueOnce(okResponse());

    const { GET } = await import('../[id]/payment-status/route');
    const res = await GET(request(), context());

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toContain('cart_id=cart_1');
  });

  it('przekazuje całą listę dowodów z cookie (kolejne zakupy)', async () => {
    cookieJar.set('_gp_completed_cart', 'cart_2,cart_1');
    fetchSpy.mockResolvedValue(okResponse());

    const { GET } = await import('../[id]/payment-status/route');
    await GET(request(), context());

    expect(fetchSpy.mock.calls[0][0]).toContain(`cart_id=${encodeURIComponent('cart_2,cart_1')}`);
  });

  it('bez cookie i bez sesji oddaje 401 do UI', async () => {
    fetchSpy.mockResolvedValue(deniedResponse(401));

    const { GET } = await import('../[id]/payment-status/route');
    const res = await GET(request(), context());

    expect(res.status).toBe(401);
    expect(fetchSpy.mock.calls[0][0]).not.toContain('cart_id');
  });
});
