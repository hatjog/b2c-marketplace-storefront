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
const getCompletedPurchaseForCart = vi.fn();
const cartHasStripePaymentIntent = vi.fn();
const provesCartOwnership = vi.fn();
const getPaymentReturnOutcome = vi.fn();

vi.mock('../cart', () => ({
  completeOrderAfterStripePayment: (...args: unknown[]) => completeOrderAfterStripePayment(...args),
  getCompletedPurchaseForCart: (...args: unknown[]) => getCompletedPurchaseForCart(...args),
  cartHasStripePaymentIntent: (...args: unknown[]) => cartHasStripePaymentIntent(...args)
}));

vi.mock('../cookies', () => ({
  provesCartOwnership: (...args: unknown[]) => provesCartOwnership(...args),
  getPaymentReturnOutcome: (...args: unknown[]) => getPaymentReturnOutcome(...args)
}));

const {
  resolvePaymentReturn,
  readStripeReturnParams,
  performPaymentReturnCompletion,
  isStripeReturnConfirmation
} = await import('../payment-return');

// Stale przenioslo sie do modulu bez `'use server'` — plik serwerowy moze
// eksportowac tylko funkcje asynchroniczne (inaczej kompilacja Next pada).
const { PAYMENT_RETURN_COMPLETION_PATH } = await import('../payment-return-constants');

const CART = 'cart_01STORY36CART';
const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';
const LOCALE = 'pl';

/** Powrót ze Stripe'a z potwierdzeniem — najczęstsze realne wejście. */
const SUCCEEDED = { redirect_status: 'succeeded', payment_intent: 'pi_3STORY36' };

beforeEach(() => {
  completeOrderAfterStripePayment.mockReset();
  getCompletedPurchaseForCart.mockReset();
  cartHasStripePaymentIntent.mockReset();
  provesCartOwnership.mockReset();
  getPaymentReturnOutcome.mockReset();
  cartHasStripePaymentIntent.mockResolvedValue(true);
  provesCartOwnership.mockResolvedValue(true);
  getPaymentReturnOutcome.mockResolvedValue(null);
  getCompletedPurchaseForCart.mockResolvedValue({
    orderIds: [],
    expectedOrderCount: null,
    state: 'empty',
    readFailed: false
  });
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
    getCompletedPurchaseForCart.mockResolvedValue({
      orderIds: [ORDER_A, ORDER_B],
      expectedOrderCount: 2,
      state: 'complete',
      readFailed: false
    });

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

    expect(getCompletedPurchaseForCart).toHaveBeenCalledWith(CART, { attempts: 2 });
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

  it('klientowski `gp_return=done` nie blokuje pierwszego domknięcia', async () => {
    const { completionRedirect, result } = await resolvePaymentReturn(
      CART,
      { ...SUCCEEDED, gp_return: 'done' },
      LOCALE
    );

    expect(completionRedirect).toContain(PAYMENT_RETURN_COMPLETION_PATH);
    expect(result).toMatchObject({ state: 'pending_confirmation' });
  });

  it('błąd odczytu mostka zatrzymuje domknięcie w nazwanym stanie recovery', async () => {
    getCompletedPurchaseForCart.mockRejectedValue(new Error('bridge down'));

    const { completionRedirect, result } = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);

    expect(completionRedirect).toBeNull();
    expect(result).toEqual({ state: 'recovery_required', reason: 'bridge_read_failed' });
  });

  it('brak dowodu własności nie odczytuje ani nie ujawnia zakupu', async () => {
    provesCartOwnership.mockResolvedValue(false);

    const { completionRedirect, result } = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);

    expect(completionRedirect).toBeNull();
    expect(result).toEqual({ state: 'return_refused', reason: 'cart_ownership_unproven' });
    expect(getCompletedPurchaseForCart).not.toHaveBeenCalled();
  });

  it.each([
    ['read_failed', 'bridge_read_failed'],
    ['access_denied', 'bridge_access_denied'],
    ['incomplete', 'incomplete_order_set']
  ] as const)('serwerowy marker %s zachowuje recovery przy pustym moście', async (outcome, reason) => {
    getPaymentReturnOutcome.mockResolvedValue(outcome);

    const { completionRedirect, result } = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);

    expect(completionRedirect).toBeNull();
    expect(result).toEqual({ state: 'recovery_required', reason });
  });

  it.each(['read_failed', 'access_denied', 'incomplete'] as const)(
    'serwerowy marker %s nie przesłania później kompletnego zestawu',
    async outcome => {
      getPaymentReturnOutcome.mockResolvedValue(outcome);
      getCompletedPurchaseForCart.mockResolvedValue({
        orderIds: [ORDER_A, ORDER_B],
        expectedOrderCount: 2,
        state: 'complete',
        readFailed: false
      });

      const { completionRedirect, result } = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);

      expect(completionRedirect).toBeNull();
      expect(result).toMatchObject({ state: 'confirmed', orderIds: [ORDER_A, ORDER_B] });
    }
  );
});

describe('AC2 — `performPaymentReturnCompletion` (część mutująca)', () => {
  it('udane domknięcie zwraca CAŁĄ kolekcję zamówień', async () => {
    const out = await performPaymentReturnCompletion(CART);

    expect(completeOrderAfterStripePayment).toHaveBeenCalledWith(CART);
    expect(out).toEqual({ orderIds: [ORDER_A, ORDER_B], outcome: 'done' });
  });

  it('porażka transportowa jest NAZWANA, nie połknięta', async () => {
    completeOrderAfterStripePayment.mockResolvedValue({
      ok: false,
      error: { code: 'completion_failed' }
    });

    expect(await performPaymentReturnCompletion(CART)).toEqual({
      orderIds: [],
      outcome: 'completion_failed'
    });
  });

  it('domknięcie bez zamówienia (płatność niepobrana) → pusta kolekcja bez fałszywej porażki', async () => {
    completeOrderAfterStripePayment.mockResolvedValue({
      ok: false,
      error: { code: 'no_order_id' }
    });

    expect(await performPaymentReturnCompletion(CART)).toEqual({
      orderIds: [],
      outcome: 'no_order_id'
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
    expect(getCompletedPurchaseForCart).not.toHaveBeenCalled();
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
    expect(getCompletedPurchaseForCart).not.toHaveBeenCalled();
    expect(completionRedirect).toBeNull();
    expect(result).toEqual({ state: 'identifier_out_of_domain' });
  });

  it('trzy różne wejścia → trzy różne, odróżnialne wyniki', async () => {
    getCompletedPurchaseForCart.mockResolvedValue({
      orderIds: [],
      expectedOrderCount: null,
      state: 'empty',
      readFailed: false
    });
    const fromCart = await resolvePaymentReturn(CART, SUCCEEDED, LOCALE);
    const fromOrder = await resolvePaymentReturn(ORDER_A, {}, LOCALE);
    const fromGarbage = await resolvePaymentReturn('nonsens', {}, LOCALE);

    expect(fromCart.completionRedirect).not.toBeNull();
    expect(fromOrder.result).toMatchObject({ state: 'confirmed', reentry: true });
    expect(fromGarbage.result).toEqual({ state: 'identifier_out_of_domain' });
    expect(fromCart.result).not.toEqual(fromOrder.result);
  });

  it('potwierdzenie powrotu wymaga POZYTYWNEGO sygnału Stripe’a', async () => {
    expect(await isStripeReturnConfirmation({ redirect_status: 'succeeded', payment_intent: 'pi_x', ambiguous: false })).toBe(true);
    expect(await isStripeReturnConfirmation({ redirect_status: 'succeeded', ambiguous: false })).toBe(false);
    expect(await isStripeReturnConfirmation({ payment_intent: 'pi_x', ambiguous: false })).toBe(false);
    expect(await isStripeReturnConfirmation({ ambiguous: false })).toBe(false);
    expect(await isStripeReturnConfirmation({ redirect_status: 'failed', ambiguous: false })).toBe(false);
    expect(
      await isStripeReturnConfirmation({ redirect_status: 'failed', payment_intent: 'pi_failed', ambiguous: false })
    ).toBe(false);
  });

  it('powtórzony parametr Stripe’a jest nazwany jako niejednoznaczny', async () => {
    const params = await readStripeReturnParams({
      payment_intent: ['pi_first', 'pi_second'],
      redirect_status: 'failed',
      payment_intent_client_secret: 'pi_first_secret_x'
    });

    expect(params).toEqual({
      payment_intent: undefined,
      redirect_status: 'failed',
      payment_intent_client_secret: 'pi_first_secret_x',
      ambiguous: true
    });
  });

  it('brak `searchParams` nie wywraca odczytu', async () => {
    expect(await readStripeReturnParams(undefined)).toEqual({
      payment_intent: undefined,
      redirect_status: undefined,
      payment_intent_client_secret: undefined,
      ambiguous: false
    });
  });
});
