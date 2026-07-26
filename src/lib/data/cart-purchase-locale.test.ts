/**
 * cart-purchase-locale.test.ts — Story 2.3 (AC3), strona storefrontu.
 *
 * Kontrakt broniony tutaj:
 *   - `purchase_locale` jest zapisywane do `cart.metadata` PRZED `completeCart`
 *     (po `complete` koszyk jest zamknięty i wartość przepadłaby),
 *   - zapis MERGE-uje metadane (nie zdmuchuje `mvp_flag_snapshot` z v160-5-9),
 *   - wartość to slug routingu (`pl|en|ua|de`), nie BCP-47,
 *   - błąd zapisu jest FAIL-OPEN: checkout kończy się sukcesem (locale nie jest
 *     warunkiem sprzedaży),
 *   - powtórny zapis tej samej wartości jest pomijany (bez zbędnego zapytania).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCartUpdate = vi.fn();
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
  setCartId: vi.fn()
}));

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

const { completeOrderAfterStripePayment } = await import('./cart');

const CART_ID = 'cart_2_3_001';
const HEADERS = { authorization: 'Bearer test-token' };

/** Ustawia metadane koszyka zwracane przez `retrieveCart` (sdk.client.fetch). */
function setCartMetadata(metadata: Record<string, unknown>): void {
  mockClientFetch.mockResolvedValue({ cart: { id: CART_ID, metadata } });
}

/** Kolejność wywołań: zapis metadanych MUSI wyprzedzić POST /complete. */
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

  mockFetchQuery.mockReset();
  mockFetchQuery.mockImplementation(async (path: string) => {
    callOrder.push(`fetch:${path}`);
    return { ok: true, data: { order: { id: 'order_1' } } };
  });
});

describe('purchase_locale — utrwalanie locale zakupu (AC3)', () => {
  it('zapisuje purchase_locale do cart.metadata przed POST /complete', async () => {
    await completeOrderAfterStripePayment(CART_ID);

    expect(mockCartUpdate).toHaveBeenCalledTimes(1);
    const [cartId, body, , headers] = mockCartUpdate.mock.calls[0];
    expect(cartId).toBe(CART_ID);
    expect((body as { metadata: Record<string, unknown> }).metadata.purchase_locale).toBe(
      'ua'
    );
    expect(headers).toEqual(HEADERS);

    // Kolejność jest istotna: po `complete` koszyk jest zamknięty.
    expect(callOrder[0]).toBe('cart.update');
    expect(callOrder[1]).toBe(`fetch:/store/carts/${CART_ID}/complete`);
  });

  it('MERGE-uje metadane — nie zdmuchuje snapshotu flagi z v160-5-9', async () => {
    await completeOrderAfterStripePayment(CART_ID);

    const [, body] = mockCartUpdate.mock.calls[0];
    expect((body as { metadata: Record<string, unknown> }).metadata).toEqual({
      mvp_flag_snapshot: 'false',
      mvp_flag_snapshot_ts: '2026-07-26T00:00:00Z',
      purchase_locale: 'ua'
    });
  });

  it('zapisuje SLUG routingu (pl|en|ua|de), nie BCP-47', async () => {
    mockResolveLocaleSlug.mockResolvedValue('de');

    await completeOrderAfterStripePayment(CART_ID);

    const [, body] = mockCartUpdate.mock.calls[0];
    const value = (body as { metadata: Record<string, unknown> }).metadata
      .purchase_locale as string;
    expect(value).toBe('de');
    expect(value).not.toContain('-');
  });

  it('pomija zapis, gdy wartość już jest ta sama (idempotencja bez zbędnego zapytania)', async () => {
    setCartMetadata({ purchase_locale: 'ua' });

    await completeOrderAfterStripePayment(CART_ID);

    expect(mockCartUpdate).not.toHaveBeenCalled();
    expect(mockFetchQuery).toHaveBeenCalledWith(
      `/store/carts/${CART_ID}/complete`,
      expect.anything()
    );
  });

  it('nadpisuje poprzednią wartość, gdy kupująca zmieniła język w trakcie sesji', async () => {
    setCartMetadata({ purchase_locale: 'pl' });
    mockResolveLocaleSlug.mockResolvedValue('en');

    await completeOrderAfterStripePayment(CART_ID);

    const [, body] = mockCartUpdate.mock.calls[0];
    expect((body as { metadata: Record<string, unknown> }).metadata.purchase_locale).toBe(
      'en'
    );
  });
});

describe('purchase_locale — FAIL-OPEN (AC3: locale nie jest warunkiem sprzedaży)', () => {
  it('błąd zapisu metadanych NIE wywraca checkoutu', async () => {
    mockCartUpdate.mockRejectedValue(new Error('409 conflict'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await completeOrderAfterStripePayment(CART_ID);

    expect(result).toMatchObject({ ok: true });
    expect(mockFetchQuery).toHaveBeenCalledWith(
      `/store/carts/${CART_ID}/complete`,
      expect.anything()
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('błąd odczytu koszyka NIE wywraca checkoutu', async () => {
    mockClientFetch.mockRejectedValue(new Error('network down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await completeOrderAfterStripePayment(CART_ID);

    expect(result).toMatchObject({ ok: true });
    expect(mockCartUpdate).not.toHaveBeenCalled();
    expect(mockFetchQuery).toHaveBeenCalledWith(
      `/store/carts/${CART_ID}/complete`,
      expect.anything()
    );
    warn.mockRestore();
  });

  it('awaria rozwiązywania locale NIE wywraca checkoutu', async () => {
    mockResolveLocaleSlug.mockRejectedValue(new Error('brak kontekstu żądania'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await completeOrderAfterStripePayment(CART_ID);

    expect(result).toMatchObject({ ok: true });
    expect(mockCartUpdate).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
