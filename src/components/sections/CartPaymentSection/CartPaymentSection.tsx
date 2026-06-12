'use client';

import { useCallback, useEffect, useState } from 'react';

import { RadioGroup } from '@headlessui/react';
import { CreditCard } from '@medusajs/icons';
import type { HttpTypes } from '@medusajs/types';
import { Container, Heading, Text } from '@medusajs/ui';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import {
  computeCheckoutCartHash,
  getCheckoutPaymentIdempotencyKey
} from '@/lib/checkout/payment-idempotency';
import { initiatePaymentSession } from '@/lib/data/cart';

import { isStripe as isStripeFunc, paymentInfoMap } from '../../../lib/constants';
import PaymentContainer from '../../organisms/PaymentContainer/PaymentContainer';
// Cross-story #A reconcile: krok 4 Stripe renderuje PaymentElement (Story
// 1.4) zamiast legacy CardElement (StripeCardContainer) — JEDNA ścieżka.
import StripePaymentElement from './StripePaymentElement';

type PendingPaymentSession = NonNullable<
  NonNullable<HttpTypes.StoreCart['payment_collection']>['payment_sessions']
>[number] & {
  data?: {
    client_secret?: unknown;
  } | null;
};

function isPendingPaymentSession(
  paymentSession: PendingPaymentSession
): paymentSession is PendingPaymentSession & { status: 'pending' } {
  return paymentSession.status === 'pending';
}

const PAYMENT_CHIP_KEYS = ['card', 'blik', 'p24', 'apple_pay', 'google_pay'] as const;
type PaymentChipKey = (typeof PAYMENT_CHIP_KEYS)[number];

function matchPaymentProviderId(
  providers: HttpTypes.StorePaymentProvider[] | null,
  chip: PaymentChipKey
): string | null {
  const ids = providers?.map(provider => provider.id) ?? [];
  const stripeId = ids.find(isStripeFunc) ?? null;
  if (chip === 'card') {
    return stripeId ?? ids.find(id => id.toLowerCase().includes('card')) ?? null;
  }
  if (chip === 'blik') {
    return ids.find(id => id.toLowerCase().includes('blik')) ?? null;
  }
  if (chip === 'p24') {
    return ids.find(id => /p24|przelewy/.test(id.toLowerCase())) ?? null;
  }
  if (chip === 'apple_pay' || chip === 'google_pay') {
    return ids.find(id => id.toLowerCase().includes(chip)) ?? stripeId;
  }
  return null;
}

const CartPaymentSection = ({
  cart,
  availablePaymentMethods,
  shippingComplete = true,
  missingShippingSellers = []
}: {
  cart: HttpTypes.StoreCart;
  availablePaymentMethods: HttpTypes.StorePaymentProvider[] | null;
  /**
   * Orphaned-charge guard (per-seller shipping). When false, at least one
   * seller in the cart still lacks a shipping method, so
   * `/store/carts/:id/complete` would reject AFTER the card is charged. The
   * pay action is blocked until every salon has a delivery method.
   */
  shippingComplete?: boolean;
  /** Names of salons still missing a delivery method (for the block message). */
  missingShippingSellers?: string[];
}) => {
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');
  const tCommon = useTranslations('common');

  const activeSession = cart.payment_collection?.payment_sessions?.find(isPendingPaymentSession);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ''
  );

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // L-2 fix: useLocale() zamiast parsowania pathname (defensywne wobec
  // schematów i18n routing bez prefiksu locale w ścieżce).
  const locale = useLocale();

  // Story 1.4 AC4/AC7 — client_secret z aktywnej Stripe payment session +
  // return_url routujący surface Story 1.5 (`/order/:id/payment-status`).
  // `:id` = cart.id (stabilny identyfikator dostępny przy confirm; order id
  // powstaje post-payment, Story 1.5 resolve'uje order z payment_intent).
  const rawStripeClientSecret = activeSession?.data?.client_secret;
  const stripeClientSecret =
    typeof rawStripeClientSecret === 'string' ? rawStripeClientSecret : undefined;
  const paymentStatusReturnUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/order/${cart?.id}/payment-status`
      : `/${locale}/order/${cart?.id}/payment-status`;

  const isOpen = searchParams.get('step') === 'payment';

  const isStripe = isStripeFunc(selectedPaymentMethod);

  const setPaymentMethod = async (method: string) => {
    setError(null);
    setSelectedPaymentMethod(method);
    if (isStripeFunc(method)) {
      const cartHash = await computeCheckoutCartHash(cart);
      await initiatePaymentSession(
        cart,
        {
          provider_id: method,
          data: { gp_checkout_cart_hash: cartHash }
        },
        getCheckoutPaymentIdempotencyKey()
      );
      // H-2 fix: revalidateTag (wykonane przez initiatePaymentSession) unieważnia
      // cache Next.js, ale NIE wymusza re-renderu RSC ani refetchu propsa `cart`.
      // router.refresh() wymusza ponowny render RSC → cart.payment_collection
      // .payment_sessions[].data.client_secret staje się dostępny → guard
      // stripeClientSecret spełniony → <StripePaymentElement> może się zamontować.
      router.refresh();
    }
  };

  // Gift cards are no longer a cart relation in Medusa v2 — the applied gift
  // card balance is exposed via the `gift_card_total` aggregate. "Paid by gift
  // card" therefore means a positive gift-card total that zeroes the cart total.
  const paidByGiftcard = (cart?.gift_card_total ?? 0) > 0 && cart?.total === 0;

  const paymentReady =
    (activeSession && (cart?.shipping_methods?.length ?? 0) > 0) || paidByGiftcard;

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
        const cartHash = await computeCheckoutCartHash(cart);
        await initiatePaymentSession(
          cart,
          {
            provider_id: selectedPaymentMethod,
            data: { gp_checkout_cart_hash: cartHash }
          },
          getCheckoutPaymentIdempotencyKey()
        );
      }

      if (!shouldInputCard) {
        router.push(pathname + '?' + createQueryString('step', 'review'), {
          scroll: false
        });
        router.refresh();
        return;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const isEditEnabled = !isOpen && !!cart?.payment_collection?.payment_sessions?.length;
  const paymentChips = PAYMENT_CHIP_KEYS.map(key => ({
    key,
    label: t(`payment_method_chip_${key}`),
    providerId: matchPaymentProviderId(availablePaymentMethods, key)
  }));

  return (
    <div
      className="bb-section-shell"
      data-testid="checkout-step-payment"
    >
      <div className={`step-head mb-6 flex flex-row items-center justify-between ${!isOpen && paymentReady ? 'is-done' : ''}`}>
        <Heading
          level="h2"
          className="flex flex-row items-center gap-x-3"
        >
          <span className="step-num">{!isOpen && paymentReady ? '✓' : '4'}</span>
          <span>{t('checkout_step_payment')}</span>
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
                <div className="pm-grid mb-4">
                  {paymentChips.map(chip => {
                    const isActive =
                      chip.providerId !== null && selectedPaymentMethod === chip.providerId;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        className={`pmchip ${isActive ? 'is-active' : ''}`}
                        disabled={!chip.providerId}
                        aria-pressed={isActive}
                        onClick={() => {
                          if (chip.providerId) {
                            setPaymentMethod(chip.providerId);
                          }
                        }}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                {availablePaymentMethods.map(paymentMethod => (
                  <div key={paymentMethod.id}>
                    <PaymentContainer
                      paymentInfoMap={paymentInfoMap}
                      paymentProviderId={paymentMethod.id}
                      selectedPaymentOptionId={selectedPaymentMethod}
                    />
                    {/* Story 1.4 — krok 4 Stripe: PaymentElement (Apple/Google
                        Pay auto, 3DS natywny) montowany po wyborze metody i
                        utworzeniu payment session (client_secret dostępny). */}
                    {isStripeFunc(paymentMethod.id) &&
                      selectedPaymentMethod === paymentMethod.id &&
                      stripeClientSecret && (
                        <StripePaymentElement
                          cartId={cart.id}
                          clientSecret={stripeClientSecret}
                          returnUrl={paymentStatusReturnUrl}
                          blocked={!shippingComplete}
                          blockedReason={
                            !shippingComplete
                              ? t('shipping_incomplete_block', {
                                  sellers: missingShippingSellers.join(', ')
                                })
                              : undefined
                          }
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

          {/* Stripe krok 4: po utworzeniu payment session PaymentElement
              (StripePaymentElement) ma WŁASNY submit (confirmPayment +
              return_url) — legacy continue button ukryty, JEDNA ścieżka. */}
          {!(isStripe && stripeClientSecret) && (
            <Button
              onClick={handleSubmit}
              variant="tonal"
              loading={isLoading}
              disabled={!selectedPaymentMethod && !paidByGiftcard}
              className={`checkout-spinner-gold rounded-full bg-[var(--cta)] hover:bg-[var(--cta-hover)] ${isLoading ? 'bg-white text-[var(--bb-gold,#C5A059)]' : 'text-white'}`}
            >
              {!activeSession && isStripeFunc(selectedPaymentMethod)
                ? t('enter_card_details')
                : t('continue_to_review')}
            </Button>
          )}
          <div className="consent-block mt-4">
            <div className="consent-row is-checked">
              <span
                className="cb"
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="label">
                {t('payment_consent_required')} <span className="req-mark">*</span>
              </span>
            </div>
            <div className="consent-row">
              <span
                className="cb"
                aria-hidden="true"
              />
              <span className="label">{t('payment_consent_marketing')}</span>
            </div>
          </div>
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
                  <Text>{t('another_step_appears')}</Text>
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
