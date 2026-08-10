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

function backendResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
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

/**
 * 2026-08-10 — ten route razem z `payment-status` tłumaczył `429` na `502`.
 * Skutek zmierzony na realnym zakupie z telefonu: ekran „nie udało się odczytać
 * zakupu" zamiast informacji, że backend prosi o zwolnienie tempa.
 */
describe('/api/v1/entitlements — 429 nie udaje awarii backendu', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('przekazuje 429 dalej jako 429 z Retry-After', async () => {
    fetchSpy.mockResolvedValue(backendResponse(429, {}, { 'retry-after': '12' }));

    const res = await GET(request('order_1'));

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('12');
    const body = await res.json();
    expect(body.error).toBe('entitlements_rate_limited');
    expect(body.backend_status).toBe(429);
  });

  it('nadal zwraca 502 dla realnej awarii backendu — rozłączność klas', async () => {
    fetchSpy.mockResolvedValue(backendResponse(500, {}));

    const res = await GET(request('order_1'));

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('entitlements_read_failed');
  });
});
