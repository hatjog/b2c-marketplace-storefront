'use client';

import React from 'react';

import type { HttpTypes } from '@medusajs/types';
import { loadStripe } from '@stripe/stripe-js';

import { isStripe } from '@/lib/constants';

import StripeWrapper from './StripeWrapper';

type PaymentWrapperProps = {
  cart: HttpTypes.StoreCart;
  children: React.ReactNode;
};

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const PaymentWrapper: React.FC<PaymentWrapperProps> = ({ cart, children }) => {
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    s => s.status === 'pending'
  );

  // Only mount the (legacy) StripeWrapper once a pending Stripe session actually has its
  // client_secret. Gating on isStripe (canonical: accepts pp_stripe*, not just the old
  // pp_card_stripe-connect) AND on client_secret prevents StripeWrapper from throwing
  // "client secret is missing" during the RSC re-render right after a session is created
  // (which surfaced as "An error occurred in the Server Components render"). The active
  // payment path (StripePaymentElement) mounts its own <Elements> regardless.
  if (
    isStripe(paymentSession?.provider_id) &&
    paymentSession?.data?.client_secret &&
    stripePromise
  ) {
    return (
      <StripeWrapper
        paymentSession={paymentSession}
        stripeKey={stripeKey}
        stripePromise={stripePromise}
      >
        {children}
      </StripeWrapper>
    );
  }

  return <div>{children}</div>;
};

export default PaymentWrapper;
