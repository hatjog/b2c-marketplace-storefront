/**
 * confirm-card-payment.test.ts — Story 7.4 AC1-c (ADR-138 DEC-3, ADR-121).
 *
 * Harness na mockach wyniku Stripe TEST `confirmCardPayment`:
 *   - happy path (succeeded / requires_capture) ⇒ complete (złóż zamówienie);
 *   - 3DS challenge (requires_action) ⇒ requires_action (NIE składaj);
 *   - card decline ⇒ error reason=declined;
 *   - error-path z intencją już opłaconą ⇒ complete (manual-capture race);
 *   - regresja latentnego buga: brak `paymentIntent` NIE rzuca TypeError.
 *
 * BonBeauty-only `pk_test_` (ADR-121 niezmieniony) — to hardening istniejącego
 * flow, nie nowy flow ani nowy market.
 */

import { describe, expect, it } from 'vitest';

import { classifyConfirmCardPaymentResult } from '../confirm-card-payment';

describe('Story 7.4 — classifyConfirmCardPaymentResult (Stripe TEST hardening)', () => {
  it('happy path: paymentIntent.status=succeeded ⇒ complete', () => {
    expect(
      classifyConfirmCardPaymentResult({ paymentIntent: { status: 'succeeded' } })
    ).toEqual({ kind: 'complete' });
  });

  it('happy path: paymentIntent.status=requires_capture (manual capture) ⇒ complete', () => {
    expect(
      classifyConfirmCardPaymentResult({ paymentIntent: { status: 'requires_capture' } })
    ).toEqual({ kind: 'complete' });
  });

  it('3DS challenge: requires_action ⇒ requires_action (NIE składaj zamówienia)', () => {
    expect(
      classifyConfirmCardPaymentResult({ paymentIntent: { status: 'requires_action' } })
    ).toEqual({ kind: 'requires_action', message: null });
  });

  it('requires_payment_method ⇒ requires_new_payment_method ze STABILNYM kluczem i18n (locale-agnostic, nie surowy literał PL)', () => {
    const outcome = classifyConfirmCardPaymentResult({
      paymentIntent: { status: 'requires_payment_method' },
    });
    expect(outcome.kind).toBe('requires_new_payment_method');
    if (outcome.kind === 'requires_new_payment_method') {
      // Lib jest locale-agnostic — zwraca klucz i18n, nie surowy polski tekst.
      // Komponent rozwiązuje copy przez `t('payment_failed_retry_other_card')`.
      // Klucz musi istnieć w messages/{pl,en,ua,de}.json → checkout.<key>.
      expect(outcome.messageKey).toBe('payment_failed_retry_other_card');
    }
  });

  it('card decline: error.code=card_declined ⇒ error reason=declined + komunikat', () => {
    const outcome = classifyConfirmCardPaymentResult({
      error: {
        type: 'card_error',
        code: 'card_declined',
        decline_code: 'generic_decline',
        message: 'Your card was declined.',
        payment_intent: { status: 'requires_payment_method' },
      },
    });
    expect(outcome).toEqual({
      kind: 'error',
      message: 'Your card was declined.',
      reason: 'declined',
    });
  });

  it('inny błąd karty (np. incorrect_cvc) ⇒ error reason=card_error', () => {
    const outcome = classifyConfirmCardPaymentResult({
      error: { type: 'card_error', code: 'incorrect_cvc', message: 'Bad CVC.' },
    });
    expect(outcome).toEqual({ kind: 'error', message: 'Bad CVC.', reason: 'card_error' });
  });

  it('error-path z intencją już opłaconą (succeeded) ⇒ complete (race manual-capture)', () => {
    expect(
      classifyConfirmCardPaymentResult({
        error: {
          type: 'api_error',
          message: 'transient',
          payment_intent: { status: 'requires_capture' },
        },
      })
    ).toEqual({ kind: 'complete' });
  });

  it('REGRESJA: błąd bez paymentIntent NIE rzuca TypeError (latentny bug :197)', () => {
    expect(() =>
      classifyConfirmCardPaymentResult({ error: { type: 'validation_error', message: 'x' } })
    ).not.toThrow();
  });

  it('REGRESJA: sukces bez paymentIntent NIE rzuca i daje noop', () => {
    expect(classifyConfirmCardPaymentResult({})).toEqual({ kind: 'noop' });
    expect(classifyConfirmCardPaymentResult(null)).toEqual({ kind: 'noop' });
    expect(classifyConfirmCardPaymentResult(undefined)).toEqual({ kind: 'noop' });
  });

  it('stan nieterminalny (processing) ⇒ noop (zachowawczo, NIE składaj)', () => {
    expect(
      classifyConfirmCardPaymentResult({ paymentIntent: { status: 'processing' } })
    ).toEqual({ kind: 'noop' });
  });
});
