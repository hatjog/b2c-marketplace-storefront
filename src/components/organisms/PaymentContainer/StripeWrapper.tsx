'use client';

import { createContext } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { Elements } from '@stripe/react-stripe-js';
import type { Stripe, StripeElementsOptions } from '@stripe/stripe-js';

type StripeWrapperProps = {
  paymentSession: HttpTypes.StorePaymentSession;
  stripeKey?: string;
  stripePromise: Promise<Stripe | null> | null;
  children: React.ReactNode;
};

export const StripeContext = createContext(false);

const StripeWrapper: React.FC<StripeWrapperProps> = ({
  paymentSession,
  stripeKey,
  stripePromise,
  children
}) => {
  const options: StripeElementsOptions = {
    clientSecret: paymentSession!.data?.client_secret as string | undefined
  };

  if (!stripeKey) {
    throw new Error('Stripe key is missing. Set NEXT_PUBLIC_STRIPE_KEY environment variable.');
  }

  if (!stripePromise) {
    throw new Error('Stripe promise is missing. Make sure you have provided a valid Stripe key.');
  }

  if (!paymentSession?.data?.client_secret) {
    // Defensive: a transiently-missing client_secret (e.g. mid-session-creation re-render)
    // must NOT crash the whole checkout RSC tree. Render children without the Stripe
    // context — the active StripePaymentElement supplies its own <Elements> once the
    // secret is available. (PaymentWrapper already gates on client_secret; this is belt
    // and suspenders.)
    return <StripeContext.Provider value={false}>{children}</StripeContext.Provider>;
  }

  return (
    <StripeContext.Provider value={true}>
      <Elements
        options={options}
        stripe={stripePromise}
      >
        {children}
      </Elements>
    </StripeContext.Provider>
  );
};

export default StripeWrapper;
