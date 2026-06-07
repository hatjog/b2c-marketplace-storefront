/**
 * confirm-card-payment — Story 7.4 (v1.11.0, ADR-138 DEC-3 / ADR-121).
 *
 * Czysty (testowalny) klasyfikator wyniku Stripe `confirmCardPayment` (TEST
 * mode, BonBeauty-only `pk_test_`, ADR-121 niezmieniony). To hardening
 * istniejącego flow `PaymentButton.tsx` — NIE nowy flow:
 *   - happy path (requires_capture / succeeded) ⇒ złóż zamówienie;
 *   - 3DS challenge (requires_action) ⇒ wymaga akcji, NIE składaj zamówienia;
 *   - card decline / inny błąd karty ⇒ pokaż komunikat błędu;
 *   - error-path z payment_intent już opłaconym (manual capture race) ⇒ złóż.
 *
 * Naprawia też latentny bug w gałęzi sukcesu: dostęp do `paymentIntent.status`
 * gdy `paymentIntent` mógł być undefined (TypeError przy błędzie bez intencji).
 *
 * Funkcja nie wykonuje efektów ubocznych — zwraca decyzję, którą komponent
 * realizuje (złożenie zamówienia / komunikat / brak akcji). Dzięki temu
 * happy/3DS/decline są pokrywalne unitowo na mockach Stripe TEST.
 */

/** Wąski kształt wyniku `stripe.confirmCardPayment` używany przez UI. */
export interface ConfirmCardPaymentResultLike {
  error?: {
    message?: string | null
    type?: string | null
    code?: string | null
    decline_code?: string | null
    payment_intent?: { status?: string | null } | null
  } | null
  paymentIntent?: { status?: string | null } | null
}

export type ConfirmCardPaymentOutcome =
  /** PaymentIntent osiągnął stan opłacony ⇒ złóż zamówienie (`placeOrder`). */
  | { kind: 'complete' }
  /** 3DS / dodatkowa autoryzacja wciąż wymagana ⇒ NIE składaj, poinformuj. */
  | { kind: 'requires_action'; message: string | null }
  /**
   * Karta wymaga wymiany (requires_payment_method) — pokaż prośbę o nową kartę.
   *
   * Lib jest locale-agnostic (4-locale storefront): zamiast surowego literału
   * zwraca STABILNY klucz i18n (`messageKey`), który komponent rozwiązuje przez
   * `useTranslations('checkout')`. Klucz musi istnieć we WSZYSTKICH katalogach
   * `messages/{pl,en,ua,de}.json` (namespace `checkout`).
   */
  | { kind: 'requires_new_payment_method'; messageKey: ConfirmCardPaymentMessageKey }
  /** Błąd karty (decline / inny) ⇒ pokaż komunikat, NIE składaj. */
  | { kind: 'error'; message: string | null; reason: ConfirmCardPaymentErrorReason }
  /** Brak akcji (stan nieterminalny, np. processing) — zachowanie zachowawcze. */
  | { kind: 'noop' }

export type ConfirmCardPaymentErrorReason =
  | 'declined'
  | 'card_error'
  | 'stripe_error'
  | 'unknown'

/**
 * Stabilny klucz i18n (namespace `checkout`) zwracany przez lib zamiast surowego
 * literału. Komponent rozwiązuje go przez `useTranslations('checkout')`. Wartość
 * MUSI istnieć w `messages/{pl,en,ua,de}.json` → `checkout.<key>`.
 */
export type ConfirmCardPaymentMessageKey = 'payment_failed_retry_other_card'

/** Stany PaymentIntent traktowane jako „opłacone" (złóż zamówienie). */
const COMPLETE_STATUSES: ReadonlySet<string> = new Set(['requires_capture', 'succeeded'])

/** Stany wymagające dalszej akcji użytkownika (3DS challenge). */
const ACTION_STATUSES: ReadonlySet<string> = new Set([
  'requires_action',
  'requires_confirmation',
])

/**
 * Stan wymagający nowej metody płatności (np. po nieudanym 3DS / odrzuceniu karty
 * bez towarzyszącego `error`). Wymaga osobnego komunikatu — nie jest 3DS challenge,
 * lecz prośbą o zmianę karty.
 */
const NEEDS_NEW_PAYMENT_METHOD_STATUS = 'requires_payment_method'

function classifyErrorReason(error: NonNullable<ConfirmCardPaymentResultLike['error']>): ConfirmCardPaymentErrorReason {
  const code = (error.code ?? error.decline_code ?? '').toLowerCase()
  if (code.includes('declin')) return 'declined'
  if (error.type === 'card_error') return 'card_error'
  if (typeof error.type === 'string' && error.type.length > 0) return 'stripe_error'
  return 'unknown'
}

/**
 * Klasyfikuje wynik `confirmCardPayment` na deterministyczną decyzję UI.
 *
 * Kolejność: błąd → (intencja w błędzie już opłacona ⇒ complete; w przeciwnym
 * razie error) → sukces (status opłacony ⇒ complete) → wymaga akcji (3DS) →
 * noop. Odporna na brak `paymentIntent` / brak `status` (bez TypeError).
 */
export function classifyConfirmCardPaymentResult(
  result: ConfirmCardPaymentResultLike | null | undefined
): ConfirmCardPaymentOutcome {
  const error = result?.error ?? null
  const paymentIntent = result?.paymentIntent ?? null

  if (error) {
    // Manual-capture / race: intencja w błędzie mogła już osiągnąć stan opłacony.
    const piStatus = error.payment_intent?.status ?? null
    if (piStatus && COMPLETE_STATUSES.has(piStatus)) {
      return { kind: 'complete' }
    }
    return {
      kind: 'error',
      message: error.message ?? null,
      reason: classifyErrorReason(error),
    }
  }

  const status = paymentIntent?.status ?? null
  if (status && COMPLETE_STATUSES.has(status)) {
    return { kind: 'complete' }
  }
  if (status && ACTION_STATUSES.has(status)) {
    return { kind: 'requires_action', message: null }
  }
  // requires_payment_method: karta wymaga wymiany (np. po nieudanym 3DS / odrzuceniu
  // bez towarzyszącego `error`). Wyświetl komunikat proszący o nową kartę.
  if (status === NEEDS_NEW_PAYMENT_METHOD_STATUS) {
    return {
      kind: 'requires_new_payment_method',
      // Locale-agnostic: zwracamy stabilny klucz i18n (nie literał). Komponent
      // rozwiązuje copy przez `t('payment_failed_retry_other_card')`.
      messageKey: 'payment_failed_retry_other_card',
    }
  }
  return { kind: 'noop' }
}
