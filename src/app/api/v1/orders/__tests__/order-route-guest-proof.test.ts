/**
 * `/api/v1/orders/[id]` — dowód gościa jedzie do upstreamu.
 *
 * ## Dlaczego ten plik istnieje
 *
 * Ta trasa była JEDYNĄ z trójki powierzchni potwierdzenia, która nie wysyłała
 * dowodu `_gp_completed_cart` — siostrzane `payment-status` i `entitlements`
 * robiły to od początku. Skutek zmierzony 2026-08-11 na żywym stacku: w jednej
 * serii żądań, z tym samym cookie, tamte dwie zwracały 200, a ta 401. Karta
 * zamówienia zamienia taką odmowę na `read_failed`, a nagłówek strony na
 * „Nie udało nam się teraz odczytać całego zakupu" — mimo że płatność przeszła
 * (490 zł przechwycone), a oba vouchery istniały.
 *
 * ## Czego ten plik NIE dowodzi
 *
 * Że kanał jest DROŻNY. Test podstawia `fetch`, więc mierzy wyłącznie to, co
 * trasa wysyła. Poprzednia wersja bramki po stronie backendu była zielona
 * w swoich testach i martwa w działaniu, bo `validateAndTransformQuery` trasy
 * core odrzucało `?cart_id=` kodem 400, zanim middleware cokolwiek zobaczyło.
 * Drożność mierzy się `curl`-em na żywym stacku i tak ma zostać.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { CART_PROOF_HEADER } from '../[id]/cart-proof-header';

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

const ORDER_ID = 'order_01TEST';

function requestFrom(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

function contextFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Zbiera nagłówki, z jakimi trasa poszła do upstreamu. */
function stubUpstream(): { calls: Array<Record<string, string>> } {
  const calls: Array<Record<string, string>> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      calls.push({ ...(init?.headers ?? {}) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          order: {
            id: ORDER_ID,
            display_id: 1,
            payment_status: 'captured',
            status: 'pending',
            updated_at: '2026-08-11T06:03:20.117Z',
            email: 'kupujaca@example.test',
            customer_id: null,
            currency_code: 'pln',
            item_total: 49000,
            total: 49000,
            items: [],
            shipping_methods: [],
          },
        }),
      };
    }),
  );
  return { calls };
}

beforeEach(() => {
  cookieJar.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('/api/v1/orders/[id] — dowód gościa', () => {
  it('KONTROLA DODATNIA: cookie dowodu trafia do upstreamu nagłówkiem', async () => {
    cookieJar.set('_gp_completed_cart', 'cart_01TEST');
    const { calls } = stubUpstream();
    const { GET } = await import('../[id]/route');

    const res = await GET(requestFrom(), contextFor(ORDER_ID));

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    // Bez tego nagłówka gość dostaje 401 i strona potwierdzenia melduje
    // „nie udało się odczytać zakupu" nad opłaconym zamówieniem.
    expect(calls[0]?.[CART_PROOF_HEADER]).toBe('cart_01TEST');
  });

  it('lista koszyków jedzie VERBATIM — obcięcie odbiera dostęp do poprzedniego zakupu', async () => {
    // `setCompletedCartId` dopisuje kolejne zakupy zamiast nadpisywać, a
    // `parseCartProof` po stronie backendu sam rozdziela listę. Wzięcie tu
    // pierwszego wpisu zamykałoby dostęp do zamówienia sprzed chwili — realny
    // scenariusz przy płatności asynchronicznej, gdzie pierwsze zamówienie jest
    // jeszcze `pending`, a kupująca zdążyła złożyć drugie.
    cookieJar.set('_gp_completed_cart', 'cart_NOWY,cart_STARY');
    const { calls } = stubUpstream();
    const { GET } = await import('../[id]/route');

    await GET(requestFrom(), contextFor(ORDER_ID));

    expect(calls[0]?.[CART_PROOF_HEADER]).toBe('cart_NOWY,cart_STARY');
  });

  it('bez cookia nagłówek NIE jest wysyłany — pusty dowód to nie dowód', async () => {
    const { calls } = stubUpstream();
    const { GET } = await import('../[id]/route');

    await GET(requestFrom(), contextFor(ORDER_ID));

    expect(calls[0] && CART_PROOF_HEADER in calls[0]).toBe(false);
  });

  it('zalogowana klientka nadal dostaje swój token, dowód gościa go nie wypiera', async () => {
    cookieJar.set('_medusa_jwt', 'jwt-token');
    cookieJar.set('_gp_completed_cart', 'cart_01TEST');
    const { calls } = stubUpstream();
    const { GET } = await import('../[id]/route');

    await GET(requestFrom(), contextFor(ORDER_ID));

    expect(calls[0]?.['authorization']).toBe('Bearer jwt-token');
    expect(calls[0]?.[CART_PROOF_HEADER]).toBe('cart_01TEST');
  });
});
