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
import { useTranslations } from 'next-intl';

// Import bezpośrednio z modułu komponentu (NIE barrel `@/components/atoms`):
// barrel re-eksportuje index.server → server-only leak do client componentu
// (anti-pattern z storefront/CLAUDE.md "Barrel exports leak server modules").
import { Button } from '@/components/atoms/Button/Button';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { completeOrderAfterStripePayment } from '@/lib/data/cart';
import { getPaymentElementAppearanceRuntime } from '@/lib/stripe/appearance';
import {
  getEnabledPaymentMethodTypes,
  getStripePromise,
  PAYMENT_NOT_AVAILABLE_MESSAGE
} from '@/lib/stripe/client';

type StripePaymentElementProps = {
  cart?: any;
  cartId?: string;
  providerId?: string;
  /** Stripe PaymentIntent client_secret z aktywnej payment session. */
  clientSecret: string;
  /** `/order/:id/payment-status` (Story 1.5 surface) — ta story tylko routuje. */
  returnUrl: string;
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
  enabledMethods: readonly string[]
): StripePaymentElementOptions {
  return { paymentMethodOrder: [...enabledMethods] };
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
export async function submitStripePayment(args: {
  stripe: Stripe | null;
  elements: StripeElements | null;
  returnUrl: string;
  completeOrder?: () => Promise<
    { ok: boolean; orderId?: string; error?: { message?: string } }
  >;
}): Promise<{ error?: string; orderId?: string }> {
  const { stripe, elements, returnUrl, completeOrder } = args;
  if (!stripe || !elements) {
    return { error: PAYMENT_NOT_AVAILABLE_MESSAGE };
  }
  try {
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required'
    });

    if (confirmError) {
      return { error: confirmError.message ?? PAYMENT_NOT_AVAILABLE_MESSAGE };
    }

    if (completeOrder) {
      const completion = await completeOrder();
      if (!completion.ok || !completion.orderId) {
        return {
          error: completion.error?.message ?? PAYMENT_NOT_AVAILABLE_MESSAGE
        };
      }
      return { orderId: completion.orderId };
    }

    return {};
  } catch (err: any) {
    return { error: err?.message ?? PAYMENT_NOT_AVAILABLE_MESSAGE };
  }
}

/**
 * Inner — MUSI być wewnątrz `<Elements>` (useStripe/useElements).
 * Deleguje do czystego `submitStripePayment` (testowalność AC7).
 */
function PaymentElementForm({
  cartId,
  enabledMethods,
  returnUrl
}: {
  cartId?: string;
  enabledMethods: readonly string[];
  returnUrl: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useTranslations('checkout');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => buildPaymentElementOptions(enabledMethods), [enabledMethods]);

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
    setIsLoading(true);
    setError(null);
    const { error: submitError, orderId } = await submitStripePayment({
      stripe,
      elements,
      returnUrl,
      completeOrder: cartId
        ? () => completeOrderAfterStripePayment(cartId)
        : undefined
    });
    if (submitError) setError(submitError);
    if (!submitError && orderId) {
      redirectToOrderStatus(orderId);
      return;
    }
    setIsLoading(false);
  }, [stripe, elements, returnUrl, cartId, redirectToOrderStatus]);

  return (
    <div
      className="my-4"
      data-testid="stripe-payment-element"
    >
      {/* AC9 — Apple Pay / Google Pay auto-aktywują się natywnie przez
          PaymentElement (brak osobnego przycisku). */}
      <PaymentElement options={options} />
      <ErrorMessage
        error={error}
        data-testid="stripe-payment-element-error"
      />
      <Button
        onClick={handleSubmit}
        variant="tonal"
        loading={isLoading}
        disabled={!stripe || !elements || isLoading}
        data-testid="stripe-payment-element-submit"
        className="mt-4 rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
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
  returnUrl
}: StripePaymentElementProps) {
  const stripePromise = getStripePromise();
  const enabledMethods = getEnabledPaymentMethodTypes();
  const appearance = useMemo(() => getPaymentElementAppearanceRuntime(), []);
  if (!stripePromise || !enabledMethods || !clientSecret) {
    return (
      <Text
        className="txt-medium text-ui-fg-subtle my-4"
        data-testid="stripe-payment-element-unavailable"
      >
        {PAYMENT_NOT_AVAILABLE_MESSAGE}
      </Text>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance }}
    >
      <PaymentElementForm
        cartId={cartId}
        enabledMethods={enabledMethods}
        returnUrl={returnUrl}
      />
    </Elements>
  );
}
