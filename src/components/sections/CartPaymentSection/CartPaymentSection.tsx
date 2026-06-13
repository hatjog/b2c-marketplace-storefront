'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';

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

// Monochrome (currentColor) glyphs so each method chip reads at a glance — the chips
// previously rendered a bare label. Brand-evocative, not exact trademark logos.
const CHIP_ICONS: Record<PaymentChipKey, ReactNode> = {
  card: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  blik: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="9.5" r="1.8" fill="currentColor" />
      <path
        d="M8 15.5c0-2.2 1.8-4 4-4s4 1.8 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  p24: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <text x="12" y="15" fontSize="8" fontWeight="700" textAnchor="middle" fill="currentColor">
        24
      </text>
    </svg>
  ),
  apple_pay: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M16.4 12.8c0-2 1.6-2.9 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.5 2s1.3-.6 2.5-.6 1.5.6 2.5.6 1.8-1 2.5-2c.5-.7.7-1.1 1-1.9-2.6-1-2.4-3.8-1.4-4.5zM14.6 6.9c.6-.7 1-1.6.9-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.5-.9 2.5.9.1 1.8-.5 2.4-1.2z" />
    </svg>
  ),
  google_pay: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M21 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h5.1c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-6.9z" fill="currentColor" />
      <path d="M12 21c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.6-1.9.9-2.9.9-2.3 0-4.2-1.5-4.9-3.6H3.9v2.4C5.4 19 8.5 21 12 21z" fill="currentColor" opacity="0.7" />
      <path d="M7.1 13.7c-.2-.6-.3-1.1-.3-1.7s.1-1.2.3-1.7V7.9H3.9C3.3 9.1 3 10.5 3 12s.3 2.9.9 4.1l3.2-2.4z" fill="currentColor" opacity="0.5" />
      <path d="M12 6.7c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.5 3.9 14.4 3 12 3 8.5 3 5.4 5 3.9 7.9l3.2 2.4C7.8 8.2 9.7 6.7 12 6.7z" fill="currentColor" opacity="0.85" />
    </svg>
  )
};

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
  missingShippingSellers = [],
  giftRecipientRequired = false,
  giftRecipientComplete = true,
  forceExpanded = false,
  locked = false
}: {
  cart: HttpTypes.StoreCart;
  availablePaymentMethods: HttpTypes.StorePaymentProvider[] | null;
  /** Checkout flow (Robert): render expanded at once instead of the `?step=` accordion. */
  forceExpanded?: boolean;
  /** Prerequisite not met (shipping/gift) → shown but greyed-out + non-interactive. */
  locked?: boolean;
  /**
   * Orphaned-charge guard (per-seller shipping). When false, at least one
   * seller in the cart still lacks a shipping method, so
   * `/store/carts/:id/complete` would reject AFTER the card is charged. The
   * pay action is blocked until every salon has a delivery method.
   */
  shippingComplete?: boolean;
  /** Names of salons still missing a delivery method (for the block message). */
  missingShippingSellers?: string[];
  giftRecipientRequired?: boolean;
  giftRecipientComplete?: boolean;
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
  // Which method chip the buyer picked (card/blik/p24/…). All chips route through the
  // single Stripe provider, but this drives per-chip visual feedback + the PaymentElement
  // method order so clicking "BLIK" visibly selects BLIK (was: only "card" ever lit up).
  const [selectedChip, setSelectedChip] = useState<PaymentChipKey>('card');

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

  const isOpen = forceExpanded || searchParams.get('step') === 'payment';

  const isStripe = isStripeFunc(selectedPaymentMethod);

  const setPaymentMethod = async (method: string) => {
    setError(null);
    setSelectedPaymentMethod(method);
    if (isStripeFunc(method)) {
      try {
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
      } catch (err: unknown) {
        // initiatePaymentSession re-throws via medusaError — surface it instead of an
        // unhandled rejection in the chip click handler.
        setError(err instanceof Error ? err.message : t('error_generic'));
      }
    }
  };

  // Gift cards are no longer a cart relation in Medusa v2 — the applied gift
  // card balance is exposed via the `gift_card_total` aggregate. "Paid by gift
  // card" therefore means a positive gift-card total that zeroes the cart total.
  const paidByGiftcard = (cart?.gift_card_total ?? 0) > 0 && cart?.total === 0;

  const paymentReady =
    ((activeSession && (cart?.shipping_methods?.length ?? 0) > 0) || paidByGiftcard) &&
    (!giftRecipientRequired || giftRecipientComplete);
  const checkoutReady = shippingComplete && (!giftRecipientRequired || giftRecipientComplete);

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
        if (!checkoutReady) {
          setError(
            !shippingComplete
              ? t('shipping_incomplete_block', {
                  sellers: missingShippingSellers.join(', ')
                })
              : t('gift_recipient.payment_block')
          );
          return;
        }
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
  const stripeProviderId = availablePaymentMethods?.map(p => p.id).find(isStripeFunc) ?? null;
  const isStripeSessionSelected =
    stripeProviderId !== null && selectedPaymentMethod === stripeProviderId;
  const paymentChips = PAYMENT_CHIP_KEYS.map(key => {
    const enabled = isChipEnabled(availablePaymentMethods, key);
    return {
      key,
      label: t(`payment_method_chip_${key}`),
      // The picked chip lights up (was: only "card" ever did) — selection still routes
      // through the single Stripe session, but the PaymentElement is re-ordered so the
      // chosen method surfaces first (see preferredMethod below).
      isActive: key === selectedChip && isStripeSessionSelected,
      enabled
    };
  });

  return (
    <div
      className="bb-section-shell"
      data-testid="checkout-step-payment"
      data-locked={locked || undefined}
      aria-disabled={locked || undefined}
    >
      <div
        className={`step-head mb-6 flex flex-row items-center justify-between ${!isOpen && paymentReady ? 'is-done' : ''}`}
      >
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
                      className={`pmchip inline-flex items-center justify-center gap-2 ${chip.isActive ? 'is-active' : ''}`}
                      disabled={!chip.enabled}
                      aria-pressed={chip.isActive}
                      // Clicking a chip records the buyer's choice (visual feedback +
                      // preferredMethod ordering for the PaymentElement) and activates the
                      // single Stripe provider session; the embedded PaymentElement then
                      // surfaces the chosen method first for native confirmation.
                      onClick={() => {
                        if (!chip.enabled) return;
                        setSelectedChip(chip.key);
                        if (stripeProviderId) {
                          void setPaymentMethod(stripeProviderId);
                        }
                      }}
                    >
                      {CHIP_ICONS[chip.key]}
                      <span>{chip.label}</span>
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
                          preferredMethod={selectedChip}
                          blocked={!checkoutReady}
                          blockedReason={
                            !shippingComplete
                              ? t('shipping_incomplete_block', {
                                  sellers: missingShippingSellers.join(', ')
                                })
                              : giftRecipientRequired && !giftRecipientComplete
                                ? t('gift_recipient.payment_block')
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
