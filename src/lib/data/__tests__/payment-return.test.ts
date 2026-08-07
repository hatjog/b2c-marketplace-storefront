/**
 * v1.15.0 Story 3.6 (AC2/AC3/AC4) — SYMULACJA PEŁNEGO PRZEKIEROWANIA 3DS.
 *
 * ── Co dokładnie jest symulowane ───────────────────────────────────────────
 * Przy pełnym przekierowaniu przeglądarka opuszcza stronę checkoutu, więc
 * kliencki `completeOrderAfterStripePayment` (jedyny wywołujący:
 * `StripePaymentElement.tsx:238`) NIGDY się nie wykonuje. Tutaj wywołujemy
 * WYŁĄCZNIE ścieżkę powrotu — dokładnie to, co robi przeglądarka wracająca od
 * Stripe'a — i mierzymy DECYZJĘ tej ścieżki.
 *
 * ── Zakres tej suity po review-fix ─────────────────────────────────────────
 * Ta suita mierzy DECYZJĘ (`resolvePaymentReturn`), nie wykonanie domknięcia,
 * i mockuje `../cart` — dlatego NIE jest dowodem AC2. Dowód, że domknięcie
 * realnie się wykonuje i że nie umiera w renderze, leży w dwóch suitach, które
 * NIE mockują modułu z defektem:
 *   • `payment-status-render.test.tsx` — renderuje stronę powrotu z `next/cache`
 *     i `next/headers` uzbrojonymi tak, żeby RZUCAŁY jak prawdziwy Next,
 *   • `app/api/v1/checkout/payment-return/__tests__/route.test.ts` — wykonuje
 *     Route Handler, który domknięcie realnie robi.
 *
 * Repo ma test realnego challenge'u 3DS jawnie pominięty
 * (`StripePaymentElement.test.tsx:218`, `it.skip(...)` — brak żywego stacka
 * i HTTPS w środowisku agenta). Ta suita nie udaje, że go zastępuje.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeOrderAfterStripePayment = vi.fn();
const getCompletedOrderIdsForCart = vi.fn();

vi.mock('../cart', () => ({
  completeOrderAfterStripePayment: (...args: unknown[]) =>
    completeOrderAfterStripePayment(...args),
  getCompletedOrderIdsForCart: (...args: unknown[]) => getCompletedOrderIdsForCart(...args)
}));

const {
  resolvePaymentReturn,
  readStripeReturnParams,
  performPaymentReturnCompletion,
  isStripeReturnConfirmation,
  PAYMENT_RETURN_COMPLETION_PATH
} = await import('../payment-return');

const CART = 'cart_01STORY36CART';
const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';
const LOCALE = 'pl';

/** Powrót ze Stripe'a z potwierdzeniem — najczęstsze realne wejście. */
const SUCCEEDED = { redirect_status: 'succeeded' };

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

describe('AC2 — powrót z 3DS domyka koszyk SERWEROWO (decyzja)', () => {
  it('wejście PROSTO na return_url oddaje domknięcie Route Handlerowi, NIE mutuje w renderze', async () => {
    const { result, completionRedirect } = await resolvePaymentReturn(
      CART,
      {
        payment_intent: 'pi_3STORY36',
        payment_intent_client_secret: 'pi_3STORY36_secret_x',
        redirect_status: 'succeeded'
      },
      LOCALE
    );

    // review-fix (HIGH): odczyt NIE domyka. Domknięcie jest mutacją i należy do
    // Route Handlera — tu ma powstać wyłącznie adres.
    expect(completeOrderAfterStripePayment).not.toHaveBeenCalled();
    expect(completionRedirect).toContain(PAYMENT_RETURN_COMPLETION_PATH);
    expect(completionRedirect).toContain(`cart_id=${CART}`);
    expect(completionRedirect).toContain(`locale=${LOCALE}`);
    expect(completionRedirect).toContain('redirect_status=succeeded');
    // Stan przed domknięciem jest nazwany, nie pusty.
    expect(result).toMatchObject({ state: 'pending_confirmation' });
  });

  it('idempotencja: koszyk JUŻ domknięty → zero domykania, czysty odczyt', async () => {
    getCompletedOrderIdsForCart.mockResolvedValue([ORDER_A, ORDER_B]);

    const { result, completionRedirect } = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);

    expect(completionRedirect).toBeNull();
    expect(completeOrderAfterStripePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      state: 'confirmed',
      reentry: true,
      orderIds: [ORDER_A, ORDER_B]
    });
  });

  it('odczyt mostka ma RETRY (2 podejścia) — lag joina nie wywołuje ponownego domknięcia', async () => {
    // review-fix (MEDIUM): jedno podejście bez czekania zwracało `[]` dla
    // koszyka JUŻ domkniętego i ścieżka powrotu inicjowała domknięcie ponownie.
    await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);

    expect(getCompletedOrderIdsForCart).toHaveBeenCalledWith(CART, { attempts: 2 });
  });

  it('porzucenie: `redirect_status=failed` NIE inicjuje domknięcia', async () => {
    const { result, completionRedirect } = await resolvePaymentReturn(
      CART,
      { redirect_status: 'failed' },
      LOCALE
    );

    expect(completionRedirect).toBeNull();
    expect(result).toMatchObject({ state: 'authentication_abandoned' });
  });

  it('BRAK parametrów powrotu NIE jest powodem do domykania (nieuwierzytelniona powierzchnia zapisu)', async () => {
    // review-fix (HIGH): warunkiem było `redirect_status !== 'failed'`, więc
    // brak parametrów przechodził jako „domykamy" — każdy bot / prefetch /
    // wpis z historii inicjował `POST /complete`.
    const { completionRedirect, result } = await resolvePaymentReturn(CART, {}, LOCALE);

    expect(completionRedirect).toBeNull();
    expect(result).toMatchObject({ state: 'pending_confirmation', reason: 'awaiting_psp' });
  });

  it('pętla powrotu jest domknięta: `gp_return=done` czyni z powrotu ODCZYT', async () => {
    const { completionRedirect, result } = await resolvePaymentReturn(
      CART,
      { ...SUCCEEDED, gp_return: 'done' },
      LOCALE
    );

    expect(completionRedirect).toBeNull();
    // Domknięcie BYŁO próbowane i nie dało zamówienia — to fakt, nie brak faktu.
    expect(result).toMatchObject({
      state: 'authentication_abandoned',
      reason: 'completion_produced_no_order'
    });
  });

  it('błąd odczytu mostka nie wywraca powrotu — domknięcie i tak zostaje zlecone', async () => {
    getCompletedOrderIdsForCart.mockRejectedValue(new Error('bridge down'));

    const { completionRedirect } = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);

    expect(completionRedirect).toContain(PAYMENT_RETURN_COMPLETION_PATH);
  });
});

describe('AC2 — `performPaymentReturnCompletion` (część mutująca)', () => {
  it('udane domknięcie zwraca CAŁĄ kolekcję zamówień', async () => {
    const out = await performPaymentReturnCompletion(CART);

    expect(completeOrderAfterStripePayment).toHaveBeenCalledWith(CART);
    expect(out).toEqual({ orderIds: [ORDER_A, ORDER_B], completionFailed: false });
  });

  it('porażka transportowa jest NAZWANA, nie połknięta', async () => {
    completeOrderAfterStripePayment.mockResolvedValue({
      ok: false,
      error: { code: 'completion_failed' }
    });

    expect(await performPaymentReturnCompletion(CART)).toEqual({
      orderIds: [],
      completionFailed: true
    });
  });

  it('domknięcie bez zamówienia (płatność niepobrana) → pusta kolekcja bez fałszywej porażki', async () => {
    completeOrderAfterStripePayment.mockResolvedValue({
      ok: false,
      error: { code: 'no_order_id' }
    });

    expect(await performPaymentReturnCompletion(CART)).toEqual({
      orderIds: [],
      completionFailed: false
    });
  });
});

describe('AC3 — rodzaj identyfikatora i parametry powrotu Stripe’a', () => {
  it('identyfikator ZAMÓWIENIA nie uruchamia domykania koszyka', async () => {
    const { identifier, result, completionRedirect } = await resolvePaymentReturn(
      ORDER_A,
      {},
      LOCALE
    );

    expect(identifier).toMatchObject({ kind: 'order' });
    expect(getCompletedOrderIdsForCart).not.toHaveBeenCalled();
    expect(completionRedirect).toBeNull();
    expect(result).toMatchObject({ state: 'confirmed', orderIds: [ORDER_A] });
  });

  it('identyfikator SPOZA DZIEDZINY → nazwany błąd, zero żądań do backendu', async () => {
    const { identifier, result, completionRedirect } = await resolvePaymentReturn(
      'nonsens',
      {},
      LOCALE
    );

    expect(identifier).toMatchObject({ kind: null, errorCode: 'identifier_out_of_domain' });
    expect(getCompletedOrderIdsForCart).not.toHaveBeenCalled();
    expect(completionRedirect).toBeNull();
    expect(result).toEqual({ state: 'identifier_out_of_domain' });
  });

  it('trzy różne wejścia → trzy różne, odróżnialne wyniki', async () => {
    getCompletedOrderIdsForCart.mockResolvedValue([]);
    const fromCart = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);
    const fromOrder = await resolvePaymentReturn(ORDER_A, {}, LOCALE);
    const fromGarbage = await resolvePaymentReturn('nonsens', {}, LOCALE);

    expect(fromCart.completionRedirect).not.toBeNull();
    expect(fromOrder.result).toMatchObject({ state: 'confirmed', reentry: true });
    expect(fromGarbage.result).toEqual({ state: 'identifier_out_of_domain' });
    expect(fromCart.result).not.toEqual(fromOrder.result);
  });

  it('potwierdzenie powrotu wymaga POZYTYWNEGO sygnału Stripe’a', async () => {
    expect(await isStripeReturnConfirmation({ redirect_status: 'succeeded' })).toBe(true);
    expect(await isStripeReturnConfirmation({ payment_intent: 'pi_x' })).toBe(true);
    expect(await isStripeReturnConfirmation({})).toBe(false);
    expect(await isStripeReturnConfirmation({ redirect_status: 'failed' })).toBe(false);
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
