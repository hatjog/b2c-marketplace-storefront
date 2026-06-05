'use client';

import React, { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useElements, useStripe } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { FlagDriftErrorModal } from '@/components/molecules/FlagDriftErrorModal';
import { placeOrder } from '@/lib/data/cart';
import { classifyConfirmCardPaymentResult } from '@/lib/payments/confirm-card-payment';

import { isManual, isStripe } from '../../../lib/constants';

const isLegacyStripeCard = (providerId?: string) =>
  providerId?.startsWith('pp_card_stripe-connect');

/**
 * Story v160-5-9 — typeguard dla FlagDriftError przepuszczonego przez
 * server action boundary. Server-side `class FlagDriftError extends Error`
 * traci `instanceof` na granicy — Next.js serializuje do plain `Error`.
 * Used `error.name === 'FlagDriftError'` per AC1 contract.
 */
function isFlagDriftError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'FlagDriftError'
  );
}

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart;
  'data-testid': string;
  /**
   * Story 2.4: When true, the button is disabled due to missing consent
   * affirmations (FR60/FR64). Visually distinct from loading/processing state.
   *
   * R5 review fix (second pass): consent-block does NOT translate to the
   * HTML `disabled` attribute — only to a separate `consentBlocked` flag
   * that the StripePaymentButton / ManualTestPaymentButton handler honours
   * by surfacing the consent error early instead of submitting. Keeping the
   * button focusable and clickable means keyboard users can reach the
   * "show errors" branch via Tab + Enter.
   */
  consentBlocked?: boolean;
};

const PaymentButton: React.FC<PaymentButtonProps> = ({ cart, 'data-testid': dataTestId, consentBlocked = false }) => {
  const t = useTranslations('checkout');
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1;

  const paymentSession = cart.payment_collection?.payment_sessions?.[0];

  switch (true) {
    case isLegacyStripeCard(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          consentBlocked={consentBlocked}
          cart={cart}
          data-testid={dataTestId}
        />
      );
    case isStripe(paymentSession?.provider_id):
      return (
        <Button
          disabled
          className="w-full min-h-11"
          aria-disabled="true"
        >
          {t('place_order')}
        </Button>
      );
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton
          notReady={notReady}
          consentBlocked={consentBlocked}
          data-testid={dataTestId}
        />
      );
    default:
      return (
        <Button
          disabled
          className="w-full"
          aria-disabled="true"
        >
          {t('select_payment_method')}
        </Button>
      );
  }
};

const StripePaymentButton = ({
  cart,
  notReady,
  consentBlocked = false,
  'data-testid': _dataTestId
}: {
  cart: HttpTypes.StoreCart;
  notReady: boolean;
  consentBlocked?: boolean;
  'data-testid'?: string;
}) => {
  const t = useTranslations('checkout');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(true);
  // Story v160-5-9 — AC4 modal state.
  const [driftModalOpen, setDriftModalOpen] = useState(false);
  const router = useRouter();

  const onPaymentCompleted = async () => {
    try {
      const res = await placeOrder();
      if (!res.ok) {
        setErrorMessage(res.error?.message);
      }
    } catch (error: any) {
      if (isFlagDriftError(error)) {
        // Story v160-5-9 — AC4: render FlagDriftErrorModal zamiast generic
        // error message. Inne errors zachowują existing UX path.
        setDriftModalOpen(true);
      } else if (error?.message !== 'NEXT_REDIRECT') {
        setErrorMessage(error?.message?.replace('Error setting up the request: ', ''));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stripe = useStripe();
  const elements = useElements();
  const card = elements?.getElement('card');

  const session = cart.payment_collection?.payment_sessions?.find(s => s.status === 'pending');

  useEffect(() => {
    //@ts-ignore
    setDisabled(!card?._complete);
  }, [card, stripe, elements, cart]);

  const handlePayment = async () => {
    // R5 review fix (second pass): refuse to submit when consent is missing.
    // The wrapping CartReview surfaces the inline consent error via its
    // capture-phase handler; this guard ensures the Stripe call never
    // happens even if some future path bypasses the wrapper.
    if (consentBlocked) {
      return;
    }
    setSubmitting(true);

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false);
      return;
    }

    // Story 7.4 (ADR-138 DEC-3) — hardening real confirmCardPayment TEST:
    // happy path / 3DS challenge (requires_action) / card decline są mapowane
    // przez czysty klasyfikator (testowalny na mockach Stripe TEST). Naprawia
    // też latentny TypeError w gałęzi sukcesu, gdy `paymentIntent` był undefined.
    const result = await stripe.confirmCardPayment(session?.data.client_secret as string, {
      payment_method: {
        card: card,
        billing_details: {
          name: cart.billing_address?.first_name + ' ' + cart.billing_address?.last_name,
          address: {
            city: cart.billing_address?.city ?? undefined,
            country: cart.billing_address?.country_code ?? undefined,
            line1: cart.billing_address?.address_1 ?? undefined,
            line2: cart.billing_address?.address_2 ?? undefined,
            postal_code: cart.billing_address?.postal_code ?? undefined,
            state: cart.billing_address?.province ?? undefined
          },
          email: cart.email,
          phone: cart.billing_address?.phone ?? undefined
        }
      }
    });

    const outcome = classifyConfirmCardPaymentResult(result);
    switch (outcome.kind) {
      case 'complete':
        await onPaymentCompleted();
        return;
      case 'requires_action':
        // 3DS wciąż wymagane (Stripe nie domknął challenge) — NIE składaj
        // zamówienia; pozwól użytkownikowi ponowić. Zdejmij stan przetwarzania.
        setSubmitting(false);
        return;
      case 'requires_new_payment_method':
        // Karta wymaga wymiany (np. po nieudanym 3DS / odrzuceniu bez błędu).
        // Pokaż komunikat — nie cicha „nie-akcja".
        setErrorMessage(outcome.message);
        setSubmitting(false);
        return;
      case 'error':
        setErrorMessage(outcome.message);
        setSubmitting(false);
        return;
      case 'noop':
      default:
        setSubmitting(false);
        return;
    }
  };

  // R5 review fix (second pass): when only consent blocks the submit, keep
  // the button focusable + clickable but mark `aria-disabled` so the
  // capture-phase handler in CartReview can surface the inline consent
  // error. Only `notReady` / Stripe-level `disabled` use HTML `disabled`.
  const htmlDisabled = disabled || notReady;
  const ariaDisabled = htmlDisabled || consentBlocked;
  return (
    <>
      <Button
        disabled={htmlDisabled}
        aria-disabled={ariaDisabled || undefined}
        onClick={handlePayment}
        loading={submitting}
        aria-busy={submitting || undefined}
        aria-label={submitting ? 'Przesyłanie zamówienia' : undefined}
        className="w-full min-h-11"
        data-testid="stripe-pay-button"
        data-consent-blocked={consentBlocked ? 'true' : undefined}
      >
        {t('place_order')}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
      <FlagDriftErrorModal
        open={driftModalOpen}
        onClose={() => setDriftModalOpen(false)}
        onReviewCart={() => {
          setDriftModalOpen(false);
          router.push('/cart');
        }}
      />
    </>
  );
};

const ManualTestPaymentButton = ({
  notReady,
  consentBlocked = false,
}: {
  notReady: boolean;
  consentBlocked?: boolean;
}) => {
  const t = useTranslations('checkout');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Story v160-5-9 — AC4 modal state.
  const [driftModalOpen, setDriftModalOpen] = useState(false);
  const router = useRouter();

  const onPaymentCompleted = async () => {
    try {
      const res = await placeOrder();
      if (!res.ok) {
        setErrorMessage(res.error?.message);
      }
    } catch (error: any) {
      if (isFlagDriftError(error)) {
        setDriftModalOpen(true);
      } else if (error?.message !== 'NEXT_REDIRECT') {
        setErrorMessage(error?.message?.replace('Error setting up the request: ', ''));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = () => {
    // R5 review fix (second pass): refuse to submit when consent is missing.
    if (consentBlocked) {
      return;
    }
    onPaymentCompleted();
  };

  return (
    <>
      <Button
        disabled={notReady}
        aria-disabled={notReady || consentBlocked || undefined}
        onClick={handlePayment}
        className="w-full min-h-11"
        loading={submitting}
        aria-busy={submitting || undefined}
        aria-label={submitting ? 'Przesyłanie zamówienia' : undefined}
        data-testid="manual-pay-button"
        data-consent-blocked={consentBlocked ? 'true' : undefined}
      >
        {t('place_order')}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
      <FlagDriftErrorModal
        open={driftModalOpen}
        onClose={() => setDriftModalOpen(false)}
        onReviewCart={() => {
          setDriftModalOpen(false);
          router.push('/cart');
        }}
      />
    </>
  );
};

export default PaymentButton;
