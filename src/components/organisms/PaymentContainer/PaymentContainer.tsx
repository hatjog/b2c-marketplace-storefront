import React, { useContext, useMemo, type JSX } from 'react';

import { Radio, Radio as RadioGroupOption } from '@headlessui/react';
import { clx, Text } from '@medusajs/ui';
import { CardElement } from '@stripe/react-stripe-js';
import type { StripeCardElementOptions } from '@stripe/stripe-js';
import { useTranslations } from 'next-intl';

import { isManual } from '../../../lib/constants';
import PaymentTest from './PaymentTest';
import SkeletonCardDetails from './SkeletonCardDetails';
import { StripeContext } from './StripeWrapper';

type PaymentContainerProps = {
  paymentProviderId: string;
  selectedPaymentOptionId: string | null;
  disabled?: boolean;
  paymentInfoMap: Record<string, { title: string; icon: JSX.Element }>;
  children?: React.ReactNode;
};

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  children
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <RadioGroupOption
      key={paymentProviderId}
      value={paymentProviderId}
      disabled={disabled}
      className={clx(
        'text-small-regular rounded-rounded hover:shadow-borders-interactive-with-active mb-2 flex cursor-pointer flex-col gap-y-2 rounded-sm border px-8 py-4',
        {
          'border-primary/20': selectedPaymentOptionId === paymentProviderId
        }
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <Radio value={selectedPaymentOptionId === paymentProviderId} />
          <Text className="text-base-regular">
            {paymentInfoMap[paymentProviderId]?.title || paymentProviderId}
          </Text>
          {isManual(paymentProviderId) && isDevelopment && (
            <PaymentTest className="small:block hidden" />
          )}
        </div>
        <span className="text-ui-fg-base justify-self-end">
          {paymentInfoMap[paymentProviderId]?.icon}
        </span>
      </div>
      {isManual(paymentProviderId) && isDevelopment && (
        <PaymentTest className="small:hidden text-[10px]" />
      )}
      {children}
    </RadioGroupOption>
  );
};

export default PaymentContainer;

export const StripeCardContainer = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  setCardBrand,
  setError,
  setCardComplete
}: Omit<PaymentContainerProps, 'children'> & {
  setCardBrand: (brand: string) => void;
  setError: (error: string | null) => void;
  setCardComplete: (complete: boolean) => void;
}) => {
  const stripeReady = useContext(StripeContext);
  const t = useTranslations('checkout');

  const useOptions: StripeCardElementOptions = useMemo(() => {
    return {
      style: {
        base: {
          fontFamily: 'Inter, sans-serif',
          color: '#424270',
          '::placeholder': {
            color: 'rgb(107 114 128)'
          }
        }
      },
      classes: {
        base: 'pt-3 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-ui-border-base hover:bg-ui-bg-field-hover transition-all duration-300 ease-in-out'
      }
    };
  }, []);

  return (
    <PaymentContainer
      paymentProviderId={paymentProviderId}
      selectedPaymentOptionId={selectedPaymentOptionId}
      paymentInfoMap={paymentInfoMap}
      disabled={disabled}
    >
      {selectedPaymentOptionId === paymentProviderId &&
        (stripeReady ? (
          <div className="my-4 transition-all duration-150 ease-in-out">
            <Text className="txt-medium-plus text-ui-fg-base mb-1">
              {t('enter_card_details')}
            </Text>
            <CardElement
              options={useOptions as StripeCardElementOptions}
              onChange={e => {
                setCardBrand(e.brand && e.brand.charAt(0).toUpperCase() + e.brand.slice(1));
                setError(e.error?.message || null);
                setCardComplete(e.complete);
              }}
            />
          </div>
        ) : (
          <SkeletonCardDetails />
        ))}
    </PaymentContainer>
  );
};
