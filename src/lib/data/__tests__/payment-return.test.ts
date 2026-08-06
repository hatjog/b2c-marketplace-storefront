/**
 * v1.15.0 Story 3.6 (AC2/AC3/AC4) — SYMULACJA PEŁNEGO PRZEKIEROWANIA 3DS.
 *
 * ── Co dokładnie jest symulowane ───────────────────────────────────────────
 * Przy pełnym przekierowaniu przeglądarka opuszcza stronę checkoutu, więc
 * kliencki `completeOrderAfterStripePayment` (jedyny wywołujący:
 * `StripePaymentElement.tsx:238`) NIGDY się nie wykonuje. Tutaj wywołujemy
 * WYŁĄCZNIE ścieżkę powrotu — dokładnie to, co robi przeglądarka wracająca od
 * Stripe'a — i mierzymy, czy koszyk zostaje domknięty.
 *
 * Repo ma test realnego challenge'u 3DS jawnie pominięty
 * (`StripePaymentElement.test.tsx:218`, `it.skip(...)` — brak żywego stacka
 * i HTTPS w środowisku agenta). Ta suita nie udaje, że go zastępuje: mierzy
 * kontrakt ścieżki powrotu, nie sam challenge.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeOrderAfterStripePayment = vi.fn();
const getCompletedOrderIdsForCart = vi.fn();

vi.mock('../cart', () => ({
  completeOrderAfterStripePayment: (...args: unknown[]) =>
    completeOrderAfterStripePayment(...args),
  getCompletedOrderIdsForCart: (...args: unknown[]) => getCompletedOrderIdsForCart(...args)
}));

const { resolvePaymentReturn, readStripeReturnParams } = await import('../payment-return');

const CART = 'cart_01STORY36CART';
const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';

beforeEach(() => {
  completeOrderAfterStripePayment.mockReset();
  getCompletedOrderIdsForCart.mockReset();
  getCompletedOrderIdsForCart.mockResolvedValue([]);
  completeOrderAfterStripePayment.mockResolvedValue({
    ok: true,
    orderId: ORDER_A,
    orderIds: [ORDER_A, ORDER_B]
  });
});

describe('AC2 — powrót z 3DS domyka koszyk SERWEROWO', () => {
  it('kontrola dodatnia: wejście PROSTO na return_url domyka koszyk i rozwiązuje N zamówień', async () => {
    const { result } = await resolvePaymentReturn(CART, {
      payment_intent: 'pi_3STORY36',
      payment_intent_client_secret: 'pi_3STORY36_secret_x',
      redirect_status: 'succeeded'
    });

    // Domknięcie wykonało się TUTAJ, na serwerze — bez udziału kodu klienta.
    expect(completeOrderAfterStripePayment).toHaveBeenCalledTimes(1);
    expect(completeOrderAfterStripePayment).toHaveBeenCalledWith(CART);
    expect(result).toEqual({
      state: 'confirmed',
      orderIds: [ORDER_A, ORDER_B],
      reentry: false
    });
  });

  it('idempotencja: powtórne wejście NIE domyka drugi raz — jest odczytem', async () => {
    getCompletedOrderIdsForCart.mockResolvedValue([ORDER_A, ORDER_B]);

    const { result } = await resolvePaymentReturn(CART, { redirect_status: 'succeeded' });

    expect(completeOrderAfterStripePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ state: 'confirmed', reentry: true, orderIds: [ORDER_A, ORDER_B] });
  });

  it('porzucenie: `redirect_status=failed` NIE inicjuje domknięcia', async () => {
    const { result } = await resolvePaymentReturn(CART, { redirect_status: 'failed' });

    expect(completeOrderAfterStripePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ state: 'authentication_abandoned' });
  });

  it('domknięcie bez zamówienia (płatność niepobrana) → stan porzucenia, nie cisza', async () => {
    completeOrderAfterStripePayment.mockResolvedValue({
      ok: false,
      error: { code: 'no_order_id' }
    });

    const { result } = await resolvePaymentReturn(CART, { redirect_status: 'succeeded' });

    expect(result).toMatchObject({
      state: 'authentication_abandoned',
      reason: 'completion_produced_no_order'
    });
  });

  it('błąd odczytu mostka nie wywraca powrotu — domknięcie i tak jest próbowane', async () => {
    getCompletedOrderIdsForCart.mockRejectedValue(new Error('bridge down'));

    const { result } = await resolvePaymentReturn(CART, { redirect_status: 'succeeded' });

    expect(completeOrderAfterStripePayment).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ state: 'confirmed' });
  });
});

describe('AC3 — rodzaj identyfikatora i parametry powrotu Stripe’a', () => {
  it('identyfikator ZAMÓWIENIA nie uruchamia domykania koszyka', async () => {
    const { identifier, result } = await resolvePaymentReturn(ORDER_A, {});

    expect(identifier).toMatchObject({ kind: 'order' });
    expect(getCompletedOrderIdsForCart).not.toHaveBeenCalled();
    expect(completeOrderAfterStripePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ state: 'confirmed', orderIds: [ORDER_A] });
  });

  it('identyfikator SPOZA DZIEDZINY → nazwany błąd, zero żądań do backendu', async () => {
    const { identifier, result } = await resolvePaymentReturn('nonsens', {});

    expect(identifier).toMatchObject({ kind: null, errorCode: 'identifier_out_of_domain' });
    expect(getCompletedOrderIdsForCart).not.toHaveBeenCalled();
    expect(completeOrderAfterStripePayment).not.toHaveBeenCalled();
    expect(result).toEqual({ state: 'identifier_out_of_domain' });
  });

  it('trzy różne wejścia → trzy różne, odróżnialne wyniki', async () => {
    getCompletedOrderIdsForCart.mockResolvedValue([]);
    const fromCart = (await resolvePaymentReturn(CART, { redirect_status: 'succeeded' })).result;
    const fromOrder = (await resolvePaymentReturn(ORDER_A, {})).result;
    const fromGarbage = (await resolvePaymentReturn('nonsens', {})).result;

    expect(fromCart).toMatchObject({ state: 'confirmed', reentry: false });
    expect(fromOrder).toMatchObject({ state: 'confirmed', reentry: true });
    expect(fromGarbage).toEqual({ state: 'identifier_out_of_domain' });
    // Koszyk i zamówienie kończą się poprawnie, ale NIE tą samą drogą.
    expect(fromCart).not.toEqual(fromOrder);
  });

  it('parametry powrotu Stripe’a są ODCZYTYWANE, także w formie powtórzonej', async () => {
    const params = await readStripeReturnParams({
      payment_intent: ['pi_first', 'pi_second'],
      redirect_status: 'failed',
      payment_intent_client_secret: 'pi_first_secret_x'
    });

    expect(params).toEqual({
      payment_intent: 'pi_first',
      redirect_status: 'failed',
      payment_intent_client_secret: 'pi_first_secret_x'
    });
  });

  it('brak `searchParams` nie wywraca odczytu', async () => {
    expect(await readStripeReturnParams(undefined)).toEqual({
      payment_intent: undefined,
      redirect_status: undefined,
      payment_intent_client_secret: undefined
    });
  });
});
