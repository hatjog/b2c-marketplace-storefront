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

/**
 * Ciasteczka sterowane z testu. `vi.hoisted`, bo fabryki `vi.mock` są wynoszone
 * ponad deklaracje modułu — bez tego stan byłby nieosiągalny w mocku.
 */
const cookieState = vi.hoisted(() => ({
  jwt: undefined as string | undefined,
  completedCartId: undefined as string | undefined,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === '_medusa_jwt' && cookieState.jwt !== undefined
        ? { name, value: cookieState.jwt }
        : undefined,
  }),
}));

vi.mock('@/lib/data/cookies', () => ({
  // Dowód gościa pochodzi WYŁĄCZNIE z cookie — nigdy z query stringu.
  getCompletedCartId: async () => cookieState.completedCartId,
}));

const { GET } = await import('../route');

beforeEach(() => {
  cookieState.jwt = undefined;
  cookieState.completedCartId = undefined;
  // Bez klucza publishable route ODMAWIA wprost (nazwany błąd konfiguracji),
  // więc każdy scenariusz „normalny" musi go mieć.
  vi.stubEnv('NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY', 'pk_test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Ostatni URL, z jakim zawołano `fetch` (albo n-ty, gdy podano indeks). */
function fetchCall(index = 0): { url: string; init: RequestInit } {
  const call = vi.mocked(globalThis.fetch).mock.calls[index];
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}

function headersOf(index = 0): Record<string, string> {
  return (fetchCall(index).init.headers ?? {}) as Record<string, string>;
}

/**
 * Żądanie z nagłówkami — bramka `checkOrigin` czyta `origin`/`referer`, więc
 * atrapa bez `headers` w ogóle nie doszłaby do logiki trasy.
 */
function makeRequest(url: URL, headers: Record<string, string> = {}): NextRequest {
  return {
    nextUrl: url,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

function request(orderId: string | null, headers: Record<string, string> = {}): NextRequest {
  const url = new URL('http://storefront.test/api/v1/entitlements');
  if (orderId !== null) {
    url.searchParams.set('order_id', orderId);
  }
  return makeRequest(url, headers);
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

/**
 * v1.15.0 DW-15-132 — KONTROLA DODATNIA „bez dowodu nie ma odczytu".
 *
 * Do tej zmiany proxy wysyłał wyłącznie `x-publishable-api-key`, czyli klucz z
 * założenia publiczny. Backendowa trasa `/store/entitlements` nie miałaby czego
 * autoryzować i musiałaby odpowiadać `401` każdemu — ekran potwierdzenia
 * pokazywałby awarię przy działającym voucherze.
 *
 * Te testy mierzą ZACHOWANIE: co naprawdę poleciało w `fetch` (nagłówki, URL).
 * Cofnięcie przekazywania dowodu w route'cie ROZWALA je, bo nagłówek
 * `authorization` albo parametr `cart_id` zniknie z faktycznego wywołania.
 */
describe('/api/v1/entitlements — przekazywanie dowodu tożsamości', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(globalThis.fetch).mockResolvedValue(backendResponse(200, []));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('zalogowana kupująca: leci `authorization: Bearer <_medusa_jwt>`', async () => {
    cookieState.jwt = 'jwt-abc';

    await GET(request('order_1'));

    expect(headersOf().authorization).toBe('Bearer jwt-abc');
    expect(headersOf()['x-publishable-api-key']).toBeDefined();
  });

  it('gość: leci `?cart_id=` z cookie i BRAK nagłówka `authorization`', async () => {
    cookieState.completedCartId = 'cart_01GUEST';

    await GET(request('order_1'));

    expect(fetchCall().url).toContain('cart_id=cart_01GUEST');
    expect(headersOf().authorization).toBeUndefined();
  });

  it('brak sesji i brak cookie koszyka: żaden dowód nie jest zmyślany', async () => {
    await GET(request('order_1'));

    expect(fetchCall().url).not.toContain('cart_id=');
    expect(headersOf().authorization).toBeUndefined();
  });

  /**
   * Dowód pochodzi WYŁĄCZNIE z cookie. Gdyby proxy czytał `cart_id` z query
   * stringu, dowolna strona podstawiłaby własny identyfikator i zamieniłaby go
   * w wyrocznię „czy ten koszyk zrobił to zamówienie".
   */
  it('IGNORUJE `cart_id` podstawiony w query stringu przeglądarki', async () => {
    const url = new URL('http://storefront.test/api/v1/entitlements');
    url.searchParams.set('order_id', 'order_1');
    url.searchParams.set('cart_id', 'cart_PODSTAWIONY');
    // OBA źródła są ustawione naraz: bez cookie parametr nie miałby z czego
    // powstać i asercja przechodziłaby niezależnie od kodu (tautologia).
    cookieState.completedCartId = 'cart_Z_COOKIE';

    await GET(makeRequest(url));

    expect(fetchCall().url).not.toContain('cart_PODSTAWIONY');
    expect(fetchCall().url).toContain('cart_id=cart_Z_COOKIE');
  });

  /**
   * Sesja nie może kasować dostępu gościa: kupująca, która zamówiła bez konta,
   * a potem się zalogowała, ma ważny JWT i ważny dowód w cookie — backend
   * widzi „nie twoje" i odpowiada `404`. Bez powtórki z samym dowodem widziała
   * „nie znaleziono" przy własnym, opłaconym zakupie.
   */
  it.each([401, 403, 404])(
    'po %i z sesją powtarza żądanie SAMYM dowodem koszyka',
    async (status) => {
      cookieState.jwt = 'jwt-abc';
      cookieState.completedCartId = 'cart_01GUEST';
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(backendResponse(status, {}))
        .mockResolvedValueOnce(backendResponse(200, [{ id: 'ent_1' }]));

      const res = await GET(request('order_1'));

      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
      expect(headersOf(1).authorization).toBeUndefined();
      expect(fetchCall(1).url).toContain('cart_id=cart_01GUEST');
      expect(res.status).toBe(200);
      expect(Array.isArray(await res.json())).toBe(true);
    }
  );

  it('bez cookie koszyka odmowa NIE jest powtarzana — kontrakt błędów bez zmian', async () => {
    cookieState.jwt = 'jwt-abc';
    vi.mocked(globalThis.fetch).mockResolvedValue(backendResponse(401, {}));

    const res = await GET(request('order_1'));

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('entitlements_access_denied');
  });
});

/**
 * v1.15.0 DW-15-132 (po recenzji) — ładunek niesie kod NA OKAZICIELA, więc
 * powierzchnia nie może być chroniona słabiej niż enum statusu płatności.
 */
describe('/api/v1/entitlements — bramka origin, cache i korelacja', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(globalThis.fetch).mockResolvedValue(backendResponse(200, []));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('obce `origin` ⇒ 403 z NAZWANYM powodem i BEZ żądania do backendu', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://storefront.test');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const res = await GET(request('order_1', { origin: 'http://zla-strona.test' }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('origin_not_allowed');
    expect(body.reason).toBe('origin_mismatch');
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
    // Odmowa NAZYWA bramkę — inaczej log kierowałby operatora pod inny plik.
    expect(String(warn.mock.calls[0]?.[0])).toContain('[entitlements]');
  });

  it('własne `origin` przechodzi — bramka nie odcina realnego ekranu potwierdzenia', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://storefront.test');

    const res = await GET(request('order_1', { origin: 'http://storefront.test' }));

    expect(res.status).toBe(200);
  });

  it('odpowiedź 200 niesie `Cache-Control: no-store`', async () => {
    const res = await GET(request('order_1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  /**
   * `404` z backendu to „cudze albo nieistniejące zamówienie" — trwała odmowa.
   * Jako `502` był dla pollera stanem przejściowym: nazwana gałąź
   * `order_not_found` w `confirmation-poller` była NIEOSIĄGALNA, a pętla mieliła
   * pełne 10 minut, kończąc ekranem awarii.
   */
  it('404 z backendu wychodzi jako `order_not_found`, NIE jako awaria odczytu', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      backendResponse(404, { type: 'not_found', request_id: 'req_deadbeef' })
    );

    const res = await GET(request('order_1'));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('order_not_found');
    expect(body.request_id).toBe('req_deadbeef');
  });

  it('`request_id` backendu jedzie dalej przy 502 — inaczej nie ma czego skorelować', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      backendResponse(503, { type: 'service_unavailable', request_id: 'req_abc123' })
    );

    const res = await GET(request('order_1'));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('entitlements_read_failed');
    expect(body.request_id).toBe('req_abc123');
  });

  it('ciało odmowy bez `request_id` nie wywraca odczytu', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Unexpected token < in JSON');
      },
      headers: { get: () => null },
    } as unknown as Response);

    const res = await GET(request('order_1'));

    expect(res.status).toBe(502);
    expect((await res.json()).request_id).toBeNull();
  });

  /**
   * Brak klucza publishable to błąd KONFIGURACJI STOREFRONTU. Backend odpowiada
   * na taki ruch `400`, co wpadało w tę samą gałąź co awaria backendu — czyli
   * trwała pomyłka wdrożeniowa była nieodróżnialna od chwilowej awarii.
   */
  it('brak klucza publishable jest NAZWANY, a backend nie jest wołany', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY', '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET(request('order_1'));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('entitlements_read_failed');
    expect(body.reason).toBe('publishable_key_missing');
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
