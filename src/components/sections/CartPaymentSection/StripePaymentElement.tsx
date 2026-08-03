'use client';

/**
 * Stripe PaymentElement — checkout step 4 (Płatność).
 *
 * Story 1.4 (v1.8.0) — AC1/AC4/AC7/AC9. Cross-story #A reconcile: punkt
 * integracji kroku 4 to ISTNIEJĄCY, czynny komponent użyty przez Story 1.3
 * (`CartPaymentSection.tsx`). NIE tworzymy równoległej ścieżki
 * `components/checkout/PaymentStep.tsx` ani `components/payment/PaymentElement.tsx`
 * (storefront NIE ma tych katalogów); rozszerzamy aktywną sekcję o ten
 * subkomponent. Decyzja odnotowana w Dev Agent Record.
 *
 * - AC4: `<Elements stripe={stripePromise} options={{ clientSecret,
 *   appearance: getPaymentElementAppearanceRuntime() }}>`; per-market
 *   publishable key z `lib/stripe/client.ts` (reuse Story 1.1 pattern).
 * - AC1: `<PaymentElement options={{ paymentMethodTypes }} />` z D6
 *   enabled_methods active market; market bez configu → graceful reject
 *   (F-NEW-H2 uniform message, NIE render PaymentElement).
 * - AC7: submit → refresh PaymentIntent przez Medusa Store API z
 *   `Idempotency-Key` (reuse Story 1.3 `payment-idempotency.ts` UUID —
 *   NIE re-implementacja) → `confirmPayment({ elements, confirmParams:
 *   { return_url } })`; `return_url` routuje surface Story 1.5.
 * - AC9: Apple Pay / Google Pay auto-aktywują się natywnie przez
 *   PaymentElement (brak osobnego przycisku) — wallet detection po stronie
 *   urządzenia klienta ze wsparciem wallet + HTTPS.
 */
import { useCallback, useMemo, useState } from 'react';

import { Text } from '@medusajs/ui';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { Stripe, StripeElements, StripePaymentElementOptions } from '@stripe/stripe-js';
import { useLocale, useTranslations } from 'next-intl';

// Import bezpośrednio z modułu komponentu (NIE barrel `@/components/atoms`):
// barrel re-eksportuje index.server → server-only leak do client componentu
// (anti-pattern z storefront/CLAUDE.md "Barrel exports leak server modules").
import { Button } from '@/components/atoms/Button/Button';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { completeOrderAfterStripePayment } from '@/lib/data/cart';
import { getPaymentElementAppearanceRuntime } from '@/lib/stripe/appearance';
import {
  getEnabledPaymentMethodTypes,
  getStripePromise
} from '@/lib/stripe/client';

type StripePaymentElementProps = {
  cart?: any;
  cartId?: string;
  providerId?: string;
  /** Stripe PaymentIntent client_secret z aktywnej payment session. */
  clientSecret: string;
  /** `/order/:id/payment-status` (Story 1.5 surface) — ta story tylko routuje. */
  returnUrl: string;
  /**
   * Orphaned-charge guard: when true, the cart cannot yet be completed (e.g.
   * a seller still lacks a shipping method, which `/store/carts/:id/complete`
   * rejects). Charging anyway would capture funds for an order that cannot be
   * created. The submit is refused and `blockedReason` is surfaced.
   */
  blocked?: boolean;
  blockedReason?: string;
  /** Closes the cart-scoped payment-session idempotency lifecycle on success. */
  onPaymentCompleted?: () => void;
  /** Buyer's chip choice (card/blik/p24/apple_pay/google_pay) — surfaced first in the
   *  PaymentElement so the chip click visibly drives the embedded Stripe method picker. */
  preferredMethod?: string;
};

/**
 * AC1 — `paymentMethodTypes` per D6 active market enabled_methods
 * (card/blik/p24). Wyodrębnione jako czysta funkcja dla testowalności.
 *
 * DRIFT (reconcile, NIE cicha zmiana — patrz Dev Agent Record): AC1
 * dosłownie mandatuje `<PaymentElement options={{ paymentMethodTypes }} />`,
 * ale @stripe/stripe-js@7.9 udostępnia `paymentMethodTypes` WYŁĄCZNIE na
 * `StripeElementsOptionsMode` (deferred intent). Nasz flow używa
 * `clientSecret` (StripeElementsOptionsClientSecret) — tam dozwolone metody
 * pochodzą z PaymentIntent.payment_method_types (egzekwowane backendowo,
 * Story 1.1/1.3). Type-valid odpowiednik na PaymentElement to
 * `paymentMethodOrder`. Zachowujemy źródło D6 jako jedyny kontrakt FE;
 * restrykcja twarda = backend PaymentIntent.
 */
export function buildPaymentElementOptions(
  enabledMethods: readonly string[],
  preferredMethod?: string
): StripePaymentElementOptions {
  // When the buyer picks a method chip above (card/blik/p24/…), surface it FIRST in
  // the PaymentElement so the click has a visible effect — the embedded Stripe UI then
  // defaults to / pre-selects that method. Falls back to the D6 enabled order.
  const order =
    preferredMethod && enabledMethods.includes(preferredMethod)
      ? [preferredMethod, ...enabledMethods.filter(method => method !== preferredMethod)]
      : [...enabledMethods];
  return { paymentMethodOrder: order };
}

/**
 * AC7 — czysty submit handler: `confirmPayment({ elements,
 * confirmParams: { return_url } })`. 3DS challenge renderowany natywnie
 * przez Stripe. Zwraca `{ error }` gdy klient-side walidacja nie przeszła
 * (NIE silent — caller pokazuje komunikat); sukces/3DS = redirect Stripe.
 *
 * M-4 fix: initiatePaymentSession NIE jest wywoływany w submit. Sesja płatności
 * jest już aktywna (stworzona w CartPaymentSection.setPaymentMethod, skąd pochodzi
 * clientSecret). Wywołanie refresh PI przed confirm powodowało mismatch —
 * jeśli backend zwróciłby nowy client_secret, instancja Elements (zbudowana
 * ze starym secretem) confirmowałaby zły PaymentIntent.
 */
/**
 * Outcome of a payment submit as a DISCRIMINATED status the UI maps to a
 * localized message — mirrors Medusa's native cart-complete contract (order
 * vs. cart-with-error) rather than leaking a raw English provider string:
 *  - completed:     order created → redirect to the status page
 *  - processing:    async pull-payment (BLIK / P24) accepted but not yet
 *                   authorized by the customer in their bank app
 *  - not_completed: PaymentIntent still needs action / was abandoned/canceled
 *  - failed:        confirm error or order-completion failure
 *  - unavailable:   Stripe / Elements not ready (market unconfigured)
 */
export type StripeSubmitResult =
  | { status: 'completed'; orderId: string }
  | { status: 'processing' }
  | { status: 'not_completed' }
  | { status: 'failed'; providerMessage?: string; code?: string }
  | { status: 'unavailable' };

export async function submitStripePayment(args: {
  stripe: Stripe | null;
  elements: StripeElements | null;
  returnUrl: string;
  completeOrder?: () => Promise<{
    ok: boolean;
    orderId?: string;
    error?: { code?: string; detail?: string };
  }>;
}): Promise<StripeSubmitResult> {
  const { stripe, elements, returnUrl, completeOrder } = args;
  if (!stripe || !elements) {
    return { status: 'unavailable' };
  }
  try {
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required'
    });

    if (confirmError) {
      // Stripe localizes confirmError.message when <Elements locale> is set,
      // so it is safe to surface directly.
      return { status: 'failed', providerMessage: confirmError.message };
    }

    // NATIVE-FLOW GUARD: only attempt order completion once the PaymentIntent
    // actually succeeded. With `redirect: 'if_required'` an async/pull payment
    // (BLIK, Przelewy24) returns here WITHOUT an error while still `processing`
    // or `requires_action` when the customer never confirmed in their bank app
    // — blindly completing then produced the opaque "no order id" failure.
    const piStatus = paymentIntent?.status;
    if (piStatus === 'processing') {
      return { status: 'processing' };
    }
    if (piStatus && piStatus !== 'succeeded' && piStatus !== 'requires_capture') {
      return { status: 'not_completed' };
    }

    if (completeOrder) {
      const completion = await completeOrder();
      if (completion.ok && completion.orderId) {
        return { status: 'completed', orderId: completion.orderId };
      }
      return { status: 'failed', code: completion.error?.code };
    }

    return { status: 'not_completed' };
  } catch (err: any) {
    return { status: 'failed', providerMessage: err?.message };
  }
}

/**
 * Inner — MUSI być wewnątrz `<Elements>` (useStripe/useElements).
 * Deleguje do czystego `submitStripePayment` (testowalność AC7).
 */
function PaymentElementForm({
  cartId,
  enabledMethods,
  preferredMethod,
  returnUrl,
  blocked = false,
  blockedReason,
  onPaymentCompleted
}: {
  cartId?: string;
  enabledMethods: readonly string[];
  preferredMethod?: string;
  returnUrl: string;
  blocked?: boolean;
  blockedReason?: string;
  onPaymentCompleted?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useTranslations('checkout');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(
    () => buildPaymentElementOptions(enabledMethods, preferredMethod),
    [enabledMethods, preferredMethod]
  );

  const redirectToOrderStatus = useCallback(
    (orderId: string) => {
      const statusUrl = cartId
        ? returnUrl.replace(`/order/${cartId}/payment-status`, `/order/${orderId}/payment-status`)
        : returnUrl;
      window.location.assign(statusUrl);
    },
    [returnUrl, cartId]
  );

  // L-5: cart i providerId usunięte z deps — initiatePaymentSession przeniesione
  // do setPaymentMethod w CartPaymentSection (fix M-4). Deps są teraz minimalne.
  const handleSubmit = useCallback(async () => {
    // Orphaned-charge guard: never call confirmPayment (which captures funds)
    // while the cart cannot be completed. Surface the reason instead.
    if (blocked) {
      setError(blockedReason ?? t('payment_unavailable'));
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await submitStripePayment({
      stripe,
      elements,
      returnUrl,
      completeOrder: cartId
        ? () => completeOrderAfterStripePayment(cartId)
        : undefined
    });
    switch (result.status) {
      case 'completed':
        onPaymentCompleted?.();
        redirectToOrderStatus(result.orderId);
        return; // keep the spinner up while navigating away
      case 'processing':
        setError(t('payment_processing'));
        break;
      case 'not_completed':
        setError(t('payment_not_completed'));
        break;
      case 'unavailable':
        setError(t('payment_unavailable'));
        break;
      case 'failed':
        // Prefer Stripe's own (locale-aware) message; otherwise map our code.
        setError(
          result.providerMessage ||
            t(result.code === 'no_order_id' ? 'payment_no_order' : 'payment_failed')
        );
        break;
    }
    setIsLoading(false);
  }, [stripe, elements, returnUrl, cartId, redirectToOrderStatus, t, blocked, blockedReason, onPaymentCompleted]);

  return (
    <div
      className="my-4"
      data-testid="stripe-payment-element"
    >
      {/* AC9 — Apple Pay / Google Pay auto-aktywują się natywnie przez
          PaymentElement (brak osobnego przycisku). */}
      <PaymentElement options={options} />
      {blocked && blockedReason && (
        <Text
          className="txt-medium text-ui-fg-subtle mt-3"
          data-testid="stripe-payment-element-blocked"
          role="status"
        >
          {blockedReason}
        </Text>
      )}
      <ErrorMessage
        error={error}
        data-testid="stripe-payment-element-error"
      />
      <Button
        onClick={handleSubmit}
        variant="tonal"
        loading={isLoading}
        disabled={!stripe || !elements || isLoading || blocked}
        aria-disabled={blocked || undefined}
        data-testid="stripe-payment-element-submit"
        className={`checkout-spinner-gold mt-4 rounded-full bg-[var(--cta)] hover:bg-[var(--cta-hover)] ${isLoading ? 'bg-white text-[var(--bb-gold,#C5A059)]' : 'text-white'}`}
      >
        {t('pay_now')}
      </Button>
    </div>
  );
}

/**
 * Wrapper — montuje `<Elements>` z runtime appearance (AC4). Graceful
 * reject (F-NEW-H2) gdy market unconfigured / brak publishable key /
 * brak enabled_methods — NIE renderuje PaymentElement, pokazuje uniform
 * message (NIE crash, NIE silent).
 */
export default function StripePaymentElement({
  cartId,
  clientSecret,
  returnUrl,
  blocked = false,
  blockedReason,
  preferredMethod,
  onPaymentCompleted
}: StripePaymentElementProps) {
  const t = useTranslations('checkout');
  const stripePromise = getStripePromise();
  const enabledMethods = getEnabledPaymentMethodTypes();
  const appearance = useMemo(() => getPaymentElementAppearanceRuntime(), []);
  // Localize Stripe's own UI + error strings (card declines, BLIK prompts) to
  // the active storefront locale. Stripe has no Ukrainian Elements locale → let
  // it auto-detect for `ua` (our own keys still cover the GP-side messages).
  const locale = useLocale();
  const STRIPE_LOCALE_BY_LOCALE: Record<string, 'pl' | 'en' | 'de'> = {
    pl: 'pl',
    en: 'en',
    de: 'de'
  };
  const stripeLocale = STRIPE_LOCALE_BY_LOCALE[locale] ?? 'auto';
  if (!stripePromise || !enabledMethods || !clientSecret) {
    // F-NEW-H2 graceful reject (market unconfigured). Localized per-locale; the
    // invariant is market-UNIFORMITY (no market-specific text), not English —
    // the stable `PAYMENT_NOT_AVAILABLE_MESSAGE` constant is kept for the
    // contract test + backend parity, this is just the user-facing render.
    return (
      <Text
        className="txt-medium text-ui-fg-subtle my-4"
        data-testid="stripe-payment-element-unavailable"
      >
        {t('payment_not_available_market')}
      </Text>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance, locale: stripeLocale }}
    >
      <PaymentElementForm
        cartId={cartId}
        enabledMethods={enabledMethods}
        preferredMethod={preferredMethod}
        returnUrl={returnUrl}
        blocked={blocked}
        blockedReason={blockedReason}
        onPaymentCompleted={onPaymentCompleted}
      />
    </Elements>
  );
}
