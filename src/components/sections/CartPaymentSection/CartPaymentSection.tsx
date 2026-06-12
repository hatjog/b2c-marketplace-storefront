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
import { getEnabledPaymentMethodTypes } from '@/lib/stripe/client';

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

/**
 * Checks whether the given Stripe payment_method_type chip is enabled for the
 * active market.  Each chip is a purely visual indicator of Stripe-level
 * payment methods (card/blik/p24/apple_pay/google_pay) — NOT a separate Medusa
 * provider.  BonBeauty routes all of them through a single pp_stripe_* provider.
 *
 * AC3 fix (MEDIUM-1): chips reflect Stripe payment_method_types (via
 * getEnabledPaymentMethodTypes()) rather than Medusa provider IDs, preventing
 * BLIK/P24 from appearing permanently disabled and avoiding the multi-is-active
 * collapse that occurred when several chips resolved to the same stripeId.
 */
function isChipEnabled(
  providers: HttpTypes.StorePaymentProvider[] | null,
  chip: PaymentChipKey
): boolean {
  const ids = providers?.map(provider => provider.id) ?? [];
  const hasStripe = ids.some(isStripeFunc);
  if (!hasStripe) return false;
  // All five chips are Stripe payment_method_types; check market enablement.
  const enabledMethods = getEnabledPaymentMethodTypes();
  if (!enabledMethods) return false;
  return enabledMethods.includes(chip);
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
  // AC3 fix (MEDIUM-1): chips are purely visual Stripe payment_method_type
  // indicators.  "Active" = the Stripe provider session is selected (not per-chip
  // provider ID, since all five share pp_stripe_*).  Each chip is enabled iff its
  // Stripe payment_method_type is available for the active market.
  const stripeProviderId =
    availablePaymentMethods?.map(p => p.id).find(isStripeFunc) ?? null;
  const isStripeSessionSelected = stripeProviderId !== null && selectedPaymentMethod === stripeProviderId;
  const paymentChips = PAYMENT_CHIP_KEYS.map(key => {
    const enabled = isChipEnabled(availablePaymentMethods, key);
    return {
      key,
      label: t(`payment_method_chip_${key}`),
      // card chip is the "active" visual representative when Stripe is selected;
      // other chips are enabled but not individually selectable (PaymentElement
      // surfaces method choice natively within the Stripe session).
      isActive: key === 'card' && isStripeSessionSelected,
      enabled
    };
  });

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
                  {paymentChips.map(chip => (
                    <button
                      key={chip.key}
                      type="button"
                      className={`pmchip ${chip.isActive ? 'is-active' : ''}`}
                      disabled={!chip.enabled}
                      aria-pressed={chip.isActive}
                      // Chips are visual indicators; payment method selection
                      // is handled natively by StripePaymentElement (PaymentElement
                      // renders tabs/wallets).  Clicking a chip activates the Stripe
                      // provider session; PaymentElement surfaces the actual type.
                      onClick={() => {
                        if (chip.enabled && stripeProviderId) {
                          void setPaymentMethod(stripeProviderId);
                        }
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
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
          {/* MEDIUM-2 fix: consent-block is a visual summary only — NOT pre-ticked.
              The real RODO active-opt-in gate (GDPR Art. 7) lives in CartReview /
              CheckoutConsentSurface.  Rendering a pre-ticked "required" consent here
              would contradict the active opt-in principle and duplicate the gate.
              Both rows are shown un-checked; their labels inform the user that consent
              will be required at the review step before payment is submitted. */}
          <div className="consent-block mt-4">
            <div className="consent-row">
              <span
                className="cb"
                aria-hidden="true"
              />
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
