/**
 * cart-purchase-locale.test.ts — Story 2.3 (AC3), strona storefrontu.
 *
 * Kontrakt broniony tutaj:
 *   - `purchase_locale` jest zapisywane do `cart.metadata` przy INICJACJI SESJI
 *     PŁATNOŚCI, czyli PRZED autoryzacją karty (R-2.3-H2),
 *   - ścieżka `complete` NIE mutuje koszyka — żadnego `POST /store/carts/:id`
 *     między `confirmCardPayment` a `/complete` (regresja = ryzyko osieroconego
 *     obciążenia, klasa incydentu z v1.11.0),
 *   - zapis MERGE-uje metadane (nie zdmuchuje `mvp_flag_snapshot` z v160-5-9),
 *   - wartość to slug routingu (`pl|en|ua|de`), nie BCP-47,
 *   - błąd zapisu jest FAIL-OPEN: sesja płatności i checkout idą dalej (locale
 *     nie jest warunkiem sprzedaży),
 *   - powtórny zapis tej samej wartości jest pomijany (bez zbędnego zapytania).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCartUpdate = vi.fn();
const mockInitiatePaymentSession = vi.fn();
const mockFetchQuery = vi.fn();
const mockGetCartId = vi.fn();
const mockGetAuthHeaders = vi.fn();
const mockGetCacheTag = vi.fn();
const mockRevalidateTag = vi.fn();
const mockResolveLocaleSlug = vi.fn();
/** `retrieveCart` idzie przez `sdk.client.fetch('/store/carts/:id')`. */
const mockClientFetch = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args)
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}));

vi.mock('../config', () => ({
  fetchQuery: (...args: unknown[]) => mockFetchQuery(...args),
  sdk: {
    client: {
      fetch: (...args: unknown[]) => mockClientFetch(...args)
    },
    store: {
      cart: {
        update: (...args: unknown[]) => mockCartUpdate(...args)
      },
      payment: {
        initiatePaymentSession: (...args: unknown[]) => mockInitiatePaymentSession(...args)
      }
    }
  }
}));

vi.mock('../env', () => ({
  resolveMedusaBackendUrl: () => 'http://localhost:9002'
}));

vi.mock('./cookies', () => ({
  getAuthHeaders: (...args: unknown[]) => mockGetAuthHeaders(...args),
  getCacheOptions: vi.fn(async () => ({})),
  getCacheTag: (...args: unknown[]) => mockGetCacheTag(...args),
  getCartId: (...args: unknown[]) => mockGetCartId(...args),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
  setCompletedCartId: (...args: unknown[]) => mockSetCompletedCartId(...args),
  getCompletedCartId: vi.fn(async () => undefined)
}));

const mockSetCompletedCartId = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock('./regions', () => ({
  getRegion: vi.fn()
}));

vi.mock('@/lib/helpers/asset-reference', () => ({
  resolveStorefrontImageSrc: (value: unknown) => value
}));

vi.mock('@/lib/helpers/market-filter', () => ({
  getMarketId: () => 'bonbeauty'
}));

vi.mock('@/lib/helpers/medusa-error', () => ({
  default: (err: unknown) => {
    throw err instanceof Error ? err : new Error('Medusa error');
  }
}));

vi.mock('@/lib/sdk/locale-interceptor', () => ({
  localeAwareFetch: vi.fn(),
  localePath: vi.fn(async (path: string) => `/pl${path}`),
  resolveStorefrontLocaleSlug: (...args: unknown[]) => mockResolveLocaleSlug(...args)
}));

vi.mock('../security/flagAtomicCheck', () => ({
  FlagDriftError: class FlagDriftError extends Error {},
  snapshotFlagAtCartStart: vi.fn(() => ({ flag: false, ts: '2026-07-26T00:00:00Z' })),
  verifyFlagUnchanged: vi.fn()
}));

const { completeOrderAfterStripePayment, getCompletedPurchaseForCart, initiatePaymentSession } =
  await import('./cart');

const CART_ID = 'cart_2_3_001';
const HEADERS = { authorization: 'Bearer test-token' };
const CART = { id: CART_ID } as never;
const PAYMENT_DATA = { provider_id: 'pp_stripe_stripe' };

/** Ustawia metadane koszyka zwracane przez `retrieveCart` (sdk.client.fetch). */
function setCartMetadata(metadata: Record<string, unknown>): void {
  mockClientFetch.mockResolvedValue({ cart: { id: CART_ID, metadata } });
}

/** Kolejność wywołań: zapis metadanych MUSI wyprzedzić inicjację sesji płatności. */
const callOrder: string[] = [];

beforeEach(() => {
  callOrder.length = 0;

  mockGetCartId.mockResolvedValue(CART_ID);
  mockGetAuthHeaders.mockResolvedValue(HEADERS);
  mockGetCacheTag.mockResolvedValue('carts');
  mockRevalidateTag.mockReset();
  mockResolveLocaleSlug.mockReset();
  mockResolveLocaleSlug.mockResolvedValue('ua');

  mockClientFetch.mockReset();
  setCartMetadata({
    mvp_flag_snapshot: 'false',
    mvp_flag_snapshot_ts: '2026-07-26T00:00:00Z'
  });

  mockCartUpdate.mockReset();
  mockCartUpdate.mockImplementation(async (...args: unknown[]) => {
    callOrder.push('cart.update');
    return { cart: { id: CART_ID, metadata: (args[1] as { metadata?: unknown })?.metadata } };
  });

  mockInitiatePaymentSession.mockReset();
  mockInitiatePaymentSession.mockImplementation(async () => {
    callOrder.push('payment.initiate');
    return { payment_collection: { id: 'pay_col_1' } };
  });

  mockFetchQuery.mockReset();
  mockFetchQuery.mockImplementation(async (path: string) => {
    callOrder.push(`fetch:${path}`);
    return { ok: true, data: { order: { id: 'order_1' } } };
  });
});

describe('purchase_locale — utrwalanie locale zakupu (AC3)', () => {
  it('zapisuje purchase_locale do cart.metadata przed inicjacją sesji płatności', async () => {
    await initiatePaymentSession(CART, PAYMENT_DATA);

    expect(mockCartUpdate).toHaveBeenCalledTimes(1);
    const [cartId, body, , headers] = mockCartUpdate.mock.calls[0];
    expect(cartId).toBe(CART_ID);
    expect((body as { metadata: Record<string, unknown> }).metadata.purchase_locale).toBe('ua');
    expect(headers).toEqual(HEADERS);

    // Kolejność jest istotna: zapis MUSI być przed autoryzacją płatności.
    expect(callOrder[0]).toBe('cart.update');
    expect(callOrder[1]).toBe('payment.initiate');
  });

  it('MERGE-uje metadane — nie zdmuchuje snapshotu flagi z v160-5-9', async () => {
    await initiatePaymentSession(CART, PAYMENT_DATA);

    const [, body] = mockCartUpdate.mock.calls[0];
    expect((body as { metadata: Record<string, unknown> }).metadata).toEqual({
      mvp_flag_snapshot: 'false',
      mvp_flag_snapshot_ts: '2026-07-26T00:00:00Z',
      purchase_locale: 'ua'
    });
  });

  it('zapisuje SLUG routingu (pl|en|ua|de), nie BCP-47', async () => {
    mockResolveLocaleSlug.mockResolvedValue('de');

    await initiatePaymentSession(CART, PAYMENT_DATA);

    const [, body] = mockCartUpdate.mock.calls[0];
    const value = (body as { metadata: Record<string, unknown> }).metadata
      .purchase_locale as string;
    expect(value).toBe('de');
    expect(value).not.toContain('-');
  });

  it('pomija zapis, gdy wartość już jest ta sama (idempotencja bez zbędnego zapytania)', async () => {
    setCartMetadata({ purchase_locale: 'ua' });

    await initiatePaymentSession(CART, PAYMENT_DATA);

    expect(mockCartUpdate).not.toHaveBeenCalled();
    expect(mockInitiatePaymentSession).toHaveBeenCalledTimes(1);
  });

  it('nadpisuje poprzednią wartość, gdy kupująca zmieniła język w trakcie sesji', async () => {
    setCartMetadata({ purchase_locale: 'pl' });
    mockResolveLocaleSlug.mockResolvedValue('en');

    await initiatePaymentSession(CART, PAYMENT_DATA);

    const [, body] = mockCartUpdate.mock.calls[0];
    expect((body as { metadata: Record<string, unknown> }).metadata.purchase_locale).toBe('en');
  });
});

describe('R-2.3-H2 — ścieżka `complete` NIE mutuje koszyka po obciążeniu karty', () => {
  it('completeOrderAfterStripePayment nie woła sdk.store.cart.update', async () => {
    const result = await completeOrderAfterStripePayment(CART_ID);

    expect(result).toMatchObject({ ok: true });
    // Inwariant R-2.3-H2 to brak MUTACJI koszyka w oknie post-charge
    // (`updateCartWorkflow` potrafi skasować sesje płatności ⇒ osierocone
    // obciążenie). Odczyt jest dozwolony i od v1.15.0 (Story 3.6) występuje:
    // mostek `completed-order` jest autorytetem kardynalności N zamówień.
    expect(mockCartUpdate).not.toHaveBeenCalled();
    expect(callOrder).toEqual([
      `fetch:/store/carts/${CART_ID}/complete`,
      `fetch:/store/carts/${CART_ID}/completed-order`
    ]);
    // Żadne żądanie w tym oknie nie jest zapisem do koszyka.
    expect(callOrder.filter(call => call.endsWith(`/carts/${CART_ID}`))).toEqual([]);
  });
});

describe('Story 3.7 — serwerowy odczyt mostka ma koniec i nie myli odmowy z awarią', () => {
  it('zawieszone żądanie kończy sygnał i daje odróżnialne readFailed', async () => {
    const seenSignals: AbortSignal[] = [];
    mockFetchQuery.mockImplementation(
      async (_path: string, options: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (!options.signal) return;
          seenSignals.push(options.signal);
          options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await getCompletedPurchaseForCart(CART_ID, { attempts: 1, timeoutMs: 5 });

    expect(seenSignals).toHaveLength(1);
    expect(seenSignals[0]).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ orderIds: [], expectedOrderCount: null, readFailed: true });
    warn.mockRestore();
  });

  it.each([401, 403])(
    'HTTP %i kończy odczyt natychmiast i nie udaje awarii systemu',
    async status => {
      mockFetchQuery.mockResolvedValue({ ok: false, status, data: null });

      const result = await getCompletedPurchaseForCart(CART_ID, { attempts: 4 });

      expect(mockFetchQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ orderIds: [], expectedOrderCount: null, readFailed: false });
    }
  );

  it('HTTP 502 zostawia w logu cart, próbę i status', async () => {
    mockFetchQuery.mockResolvedValue({ ok: false, status: 502, data: null });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await getCompletedPurchaseForCart(CART_ID, { attempts: 1 });

    expect(warn).toHaveBeenCalledWith(
      `[confirmation] bridge read failed cart=${CART_ID} attempt=1 status=502`
    );
    warn.mockRestore();
  });
});

describe('purchase_locale — FAIL-OPEN (AC3: locale nie jest warunkiem sprzedaży)', () => {
  it('błąd zapisu metadanych NIE blokuje inicjacji sesji płatności', async () => {
    mockCartUpdate.mockRejectedValue(new Error('409 conflict'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await initiatePaymentSession(CART, PAYMENT_DATA);

    expect(mockInitiatePaymentSession).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('błąd odczytu koszyka NIE blokuje inicjacji sesji płatności', async () => {
    mockClientFetch.mockRejectedValue(new Error('network down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await initiatePaymentSession(CART, PAYMENT_DATA);

    expect(mockCartUpdate).not.toHaveBeenCalled();
    expect(mockInitiatePaymentSession).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('awaria rozwiązywania locale NIE blokuje inicjacji sesji płatności', async () => {
    mockResolveLocaleSlug.mockRejectedValue(new Error('brak kontekstu żądania'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await initiatePaymentSession(CART, PAYMENT_DATA);

    expect(mockCartUpdate).not.toHaveBeenCalled();
    expect(mockInitiatePaymentSession).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('dowód dostępu gościa przy inicjacji sesji płatności', () => {
  it('zapisuje cart_id jako dowód JUŻ przy initiatePaymentSession', async () => {
    // Przy pełnym przekierowaniu 3DS/BLIK przeglądarka opuszcza stronę i kod
    // po `confirmPayment` nigdy się w niej nie wykona — dowód zapisany dopiero
    // po domknięciu zamówienia by nie powstał, a gość wróciłby na 401.
    mockSetCompletedCartId.mockClear();
    const { initiatePaymentSession } = await import('./cart');

    await initiatePaymentSession({ id: CART_ID } as any, { provider_id: 'pp_stripe_stripe' });

    expect(mockSetCompletedCartId).toHaveBeenCalledWith(CART_ID);
  });
});
