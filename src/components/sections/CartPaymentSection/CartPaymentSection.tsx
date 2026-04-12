'use client';

import { useCallback, useEffect, useState } from 'react';

import { RadioGroup } from '@headlessui/react';
import { CheckCircleSolid, CreditCard } from '@medusajs/icons';
import { Container, Heading, Text } from '@medusajs/ui';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { initiatePaymentSession } from '@/lib/data/cart';

import { isStripe as isStripeFunc, paymentInfoMap } from '../../../lib/constants';
import PaymentContainer, {
  StripeCardContainer
} from '../../organisms/PaymentContainer/PaymentContainer';

type StoreCardPaymentMethod = any & {
  service_zone?: {
    fulfillment_set: {
      type: string;
    };
  };
};

const CartPaymentSection = ({
  cart,
  availablePaymentMethods
}: {
  cart: any;
  availablePaymentMethods: StoreCardPaymentMethod[] | null;
}) => {
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');

  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === 'pending'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ''
  );

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const isOpen = searchParams.get('step') === 'payment';

  const isStripe = isStripeFunc(selectedPaymentMethod);

  const setPaymentMethod = async (method: string) => {
    setError(null);
    setSelectedPaymentMethod(method);
    if (isStripeFunc(method)) {
      await initiatePaymentSession(cart, {
        provider_id: method
      });
    }
  };

  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0;

  const paymentReady = (activeSession && cart?.shipping_methods.length !== 0) || paidByGiftcard;

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(name, value);

      return params.toString();
    },
    [searchParams]
  );

  const handleEdit = () => {
    router.push(pathname + '?' + createQueryString('step', 'payment'), {
      scroll: false
    });
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const shouldInputCard = isStripeFunc(selectedPaymentMethod) && !activeSession;

      const checkActiveSession = activeSession?.provider_id === selectedPaymentMethod;

      if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod
        });
      }

      if (!shouldInputCard) {
        router.push(pathname + '?' + createQueryString('step', 'review'), {
          scroll: false
        });
        router.refresh();
        return;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const isEditEnabled = !isOpen && !!cart?.payment_collection?.payment_sessions?.length;

  return (
    <div
      className="bb-section-shell"
      data-testid="checkout-step-payment"
    >
      <div className="mb-6 flex flex-row items-center justify-between">
        <Heading
          level="h2"
          className="text-3xl-regular flex flex-row items-center items-baseline gap-x-2"
        >
          {!isOpen && paymentReady && <CheckCircleSolid />}
          {t('payment_heading')}
        </Heading>
        {isEditEnabled && (
          <Text>
            <Button
              data-testid="checkout-payment-edit-button"
              onClick={handleEdit}
              variant="tonal"
            >
              {tCommon('edit')}
            </Button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? 'block' : 'hidden'}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {availablePaymentMethods.map(paymentMethod => (
                  <div key={paymentMethod.id}>
                    {isStripeFunc(paymentMethod.id) ? (
                      <StripeCardContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setCardBrand={setCardBrand}
                        setError={setError}
                        setCardComplete={setCardComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex w-1/3 flex-col">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">{t('payment_method')}</Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                {tCart('gift_card')}
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            onClick={handleSubmit}
            variant="tonal"
            loading={isLoading}
            disabled={(isStripe && !cardComplete) || (!selectedPaymentMethod && !paidByGiftcard)}
            className="rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
          >
            {!activeSession && isStripeFunc(selectedPaymentMethod)
              ? t('enter_card_details')
              : t('continue_to_review')}
          </Button>
        </div>

        <div className={isOpen ? 'hidden' : 'block'}>
          {cart && paymentReady && activeSession ? (
            <div className="flex w-full items-start gap-x-1">
              <div className="flex w-1/3 flex-col">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">{t('payment_method')}</Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[activeSession?.provider_id]?.title || activeSession?.provider_id}
                </Text>
              </div>
              <div className="flex w-1/3 flex-col">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">{t('payment_details')}</Text>
                <div
                  className="txt-medium text-ui-fg-subtle flex items-center gap-2"
                  data-testid="payment-details-summary"
                >
                  <Container
                    className="bg-ui-button-neutral-hover flex h-7 w-fit items-center p-2"
                    data-testid="payment-details-summary"
                  >
                    {paymentInfoMap[selectedPaymentMethod]?.icon || <CreditCard />}
                  </Container>
                  <Text>
                    {isStripeFunc(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : t('another_step_appears')}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex w-1/3 flex-col">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">{t('payment_method')}</Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                {tCart('gift_card')}
              </Text>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CartPaymentSection;
