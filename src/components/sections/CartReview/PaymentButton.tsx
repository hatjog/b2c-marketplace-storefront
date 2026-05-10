'use client';

import React, { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useElements, useStripe } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { FlagDriftErrorModal } from '@/components/molecules/FlagDriftErrorModal';
import { placeOrder } from '@/lib/data/cart';

import { isManual, isStripe } from '../../../lib/constants';

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
   */
  consentBlocked?: boolean;
};

const PaymentButton: React.FC<PaymentButtonProps> = ({ cart, 'data-testid': dataTestId, consentBlocked = false }) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1;

  const paymentSession = cart.payment_collection?.payment_sessions?.[0];

  switch (true) {
    case isStripe(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady || consentBlocked}
          cart={cart}
          data-testid={dataTestId}
        />
      );
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton
          notReady={notReady || consentBlocked}
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
          Select a payment method
        </Button>
      );
  }
};

const StripePaymentButton = ({
  cart,
  notReady,
  'data-testid': _dataTestId
}: {
  cart: HttpTypes.StoreCart;
  notReady: boolean;
  'data-testid'?: string;
}) => {
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
    setSubmitting(true);

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false);
      return;
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
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
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent;

          if ((pi && pi.status === 'requires_capture') || (pi && pi.status === 'succeeded')) {
            onPaymentCompleted();
          }

          setErrorMessage(error.message || null);
          return;
        }

        if (
          (paymentIntent && paymentIntent.status === 'requires_capture') ||
          paymentIntent.status === 'succeeded'
        ) {
          return onPaymentCompleted();
        }

        return;
      });
  };

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        loading={submitting}
        aria-busy={submitting || undefined}
        aria-label={submitting ? 'Przesyłanie zamówienia' : undefined}
        className="w-full min-h-11"
        data-testid="stripe-pay-button"
      >
        Place order
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

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
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
    onPaymentCompleted();
  };

  return (
    <>
      <Button
        disabled={notReady}
        onClick={handlePayment}
        className="w-full min-h-11"
        loading={submitting}
        aria-busy={submitting || undefined}
        aria-label={submitting ? 'Przesyłanie zamówienia' : undefined}
        data-testid="manual-pay-button"
      >
        Place order
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
