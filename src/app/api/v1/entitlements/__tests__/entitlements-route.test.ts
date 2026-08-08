/**
 * v1.15.0 Story 3.7 (AC3, AD-19) — BFF nie zamienia awarii w ciszę.
 *
 * Test pęka po przywróceniu `return NextResponse.json([], { status: 200 })`
 * dla porażki backendu albo dla wyjątku sieciowego: wtedy „nie ma jeszcze
 * voucherów" i „backend leży" znów stają się nieodróżnialne, a klient wnioskuje
 * `unknown` i odpytuje dalej.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/env', () => ({
  resolveMedusaBackendUrl: () => 'http://backend.test',
}));

vi.mock('@/lib/voucher/voucher-rules', () => ({
  normalizeVoucherRules: () => ({}),
}));

const { GET } = await import('../route');

function request(orderId: string | null): NextRequest {
  const url = new URL('http://storefront.test/api/v1/entitlements');
  if (orderId !== null) {
    url.searchParams.set('order_id', orderId);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

function backendResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('GET /api/v1/entitlements', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sukces oddaje KOLEKCJĘ z HTTP 200 (kształt niezmieniony)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      backendResponse(200, [{ id: 'ent_1', status: 'issued' }])
    );

    const res = await GET(request('order_1'));

    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('awaria backendu daje 502, NIE pustej kolekcji z HTTP 200', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(backendResponse(500, {}));

    const res = await GET(request('order_1'));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body.error).toBe('entitlements_read_failed');
  });

  it('wyjątek sieciowy daje 502, NIE pustej kolekcji z HTTP 200', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET(request('order_1'));

    expect(res.status).toBe(502);
    expect(Array.isArray(await res.json())).toBe(false);
  });

  it.each([401, 403])(
    'odmowa dostępu %i idzie dalej WŁASNYM kodem — poller kończy pętlę natychmiast',
    async (status) => {
      vi.mocked(globalThis.fetch).mockResolvedValue(backendResponse(status, {}));

      const res = await GET(request('order_1'));

      expect(res.status).toBe(status);
    }
  );

  it('kształt spoza dziedziny jest błędem, nie pustą kolekcją', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(backendResponse(200, { not: 'an array' }));

    const res = await GET(request('order_1'));

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('entitlements_shape_invalid');
  });

  it('brak order_id nadal daje 400', async () => {
    const res = await GET(request(null));
    expect(res.status).toBe(400);
  });
});
