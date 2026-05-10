'use client';

/**
 * CartReview — Checkout review step.
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Retrofit: added inline consent surfaces (FR60/FR64), VoucherClaritySurface
 * condensed variant per-seller-group, and SellerProofSurface summaries above
 * the Pay button so the customer sees voucher rules and seller identity before
 * paying (AC1 anchor).
 *
 * Submit button is blocked until both consent checkboxes are checked.
 * Consent checkboxes are NOT pre-ticked (active opt-in; GDPR Art. 7 / RODO).
 * NFR23: No marketing opt-in bundled (transactional-only v1.7.0).
 */

import { useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { CheckoutConsentSurface } from '@/components/molecules/CheckoutConsentSurface/CheckoutConsentSurface';
import { CartSummary } from '@/components/organisms';
import { PromoCode } from '@/components/organisms/PromoCode/PromoCode';

import { CartItems } from './CartItems';
import PaymentButton from './PaymentButton';

const Review = ({ cart }: { cart: any }) => {
  const t = useTranslations('checkout');
  const locale = useLocale();

  // Consent state — required before submit (FR60 + FR64).
  const [transactionalConsentChecked, setTransactionalConsentChecked] = useState(false);
  const [withdrawalAckChecked, setWithdrawalAckChecked] = useState(false);
  const [showConsentErrors, setShowConsentErrors] = useState(false);

  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0;

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard);

  const consentReady = transactionalConsentChecked && withdrawalAckChecked;

  // Show consent errors when user tries to submit without ticking both.
  const handlePayAttempt = () => {
    if (!consentReady) {
      setShowConsentErrors(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-6 w-full">
        <CartItems cart={cart} />
      </div>

      <div className={'mb-6'}>
        <PromoCode cart={cart} />
      </div>

      <div className="bb-section-shell bb-section-shell-strong mb-6 w-full">
        <CartSummary
          item_total={cart?.item_subtotal || 0}
          shipping_total={cart?.shipping_subtotal || 0}
          total={cart?.total || 0}
          currency_code={cart?.currency_code || ''}
          tax={cart?.tax_total || 0}
          discount_total={cart?.discount_total || 0}
        />
      </div>

      {previousStepsCompleted && (
        <>
          {/* ─── Inline consent surfaces (FR60 / FR64) ─────────────────────
              Must be visible at review step before Pay — NOT modal-only.
              NFR23: transactional only; no marketing consent bundled here. */}
          <div
            className="bb-section-shell border border-primary rounded-sm p-4 space-y-1"
            data-testid="checkout-review-consent-block"
          >
            <p className="label-sm font-medium text-primary mb-3">
              {t('consent.required_heading')}
            </p>
            <CheckoutConsentSurface
              transactionalConsentChecked={transactionalConsentChecked}
              withdrawalAckChecked={withdrawalAckChecked}
              onTransactionalConsentChange={setTransactionalConsentChecked}
              onWithdrawalAckChange={setWithdrawalAckChecked}
              showErrors={showConsentErrors}
              locale={locale}
            />
          </div>

          <p className="label-sm mb-3 text-center text-secondary">
            {t('payment_obligation_notice')}
          </p>

          {/* ─── Pay button wrapped in consent gate ─────────────────────── */}
          <div
            onClick={!consentReady ? handlePayAttempt : undefined}
            data-testid="checkout-pay-button-wrapper"
          >
            <PaymentButton
              cart={cart}
              data-testid="submit-order-button"
              consentBlocked={!consentReady}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Review;
