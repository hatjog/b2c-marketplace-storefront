'use client';

import React from 'react';

import type { HttpTypes } from '@medusajs/types';
import { loadStripe } from '@stripe/stripe-js';

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

  if (paymentSession?.provider_id?.startsWith('pp_card_stripe-connect') && paymentSession && stripePromise) {
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
