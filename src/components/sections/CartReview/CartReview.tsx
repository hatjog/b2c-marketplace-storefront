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

import { useId, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { CheckoutConsentSurface } from '@/components/molecules/CheckoutConsentSurface/CheckoutConsentSurface';
import { CartSummary } from '@/components/organisms';
import { PromoCode } from '@/components/organisms/PromoCode/PromoCode';
import { useFormErrors } from '@/hooks/useFormErrors';

import { CartItems } from './CartItems';
import PaymentButton from './PaymentButton';

const Review = ({ cart }: { cart: any }) => {
  const t = useTranslations('checkout');
  const locale = useLocale();

  // Consent state — required before submit (FR60 + FR64).
  const [transactionalConsentChecked, setTransactionalConsentChecked] = useState(false);
  const [withdrawalAckChecked, setWithdrawalAckChecked] = useState(false);
  const [showConsentErrors, setShowConsentErrors] = useState(false);

  // F5/F15 review fixes: real heading semantics + first-error focus management.
  const consentHeadingId = useId();
  const consentBlockRef = useRef<HTMLDivElement | null>(null);

  // F6 review fix: actually wire useFormErrors so it is no longer dead code.
  // Used here for consistent focus-first-error semantics on the consent block.
  const { focusFirstError, registerFieldRef } = useFormErrors('checkout-consent');

  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0;

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard);

  const consentReady = transactionalConsentChecked && withdrawalAckChecked;

  // F5 review fix: surface the consent error AND scroll/focus the consent
  // block on the user's actual interaction. Disabled <button> elements do
  // NOT bubble click events in any modern browser, so the previous
  // `<div onClick>` wrapper around a `disabled` Pay button silently failed.
  // Now: capture the click in CAPTURE phase before it reaches the button so
  // that even when the button is disabled (or about to be) we react to the
  // user's intent.
  const handlePayAttemptCapture = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!consentReady) {
      e.preventDefault();
      e.stopPropagation();
      setShowConsentErrors(true);
      const el = consentBlockRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
      // F6 review fix: route focus through useFormErrors.focusFirstError
      // so the focus order honours DOM/registration order (transactional
      // first, then withdrawal). Falls back to direct querySelector lookup
      // if the registered ref is unavailable (defensive — refs may not
      // attach if the surface re-renders mid-handler).
      focusFirstError({
        transactional: transactionalConsentChecked ? null : 'required',
        withdrawal: withdrawalAckChecked ? null : 'required',
      });
      const firstUnchecked = el?.querySelector<HTMLInputElement>(
        !transactionalConsentChecked
          ? '[data-testid="checkout-consent-transactional-checkbox"]'
          : '[data-testid="checkout-consent-withdrawal-checkbox"]',
      );
      if (firstUnchecked && document.activeElement !== firstUnchecked) {
        firstUnchecked.focus({ preventScroll: false });
      }
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
            ref={consentBlockRef}
            className="bb-section-shell bb-section-shell-strong border border-primary rounded-sm p-4 space-y-1"
            data-testid="checkout-review-consent-block"
            aria-labelledby={consentHeadingId}
          >
            {/* F15 review fix: real heading element so SR landmark navigation works. */}
            <h2
              id={consentHeadingId}
              className="label-sm font-medium text-primary mb-3"
            >
              {t('consent.required_heading')}
            </h2>
            {showConsentErrors && !consentReady && (
              <p
                role="alert"
                className="label-sm mb-2 text-[var(--color-error)]"
                data-testid="checkout-consent-block-error"
              >
                {t('consent.required_summary_error')}
              </p>
            )}
            <CheckoutConsentSurface
              transactionalConsentChecked={transactionalConsentChecked}
              withdrawalAckChecked={withdrawalAckChecked}
              onTransactionalConsentChange={setTransactionalConsentChecked}
              onWithdrawalAckChange={setWithdrawalAckChecked}
              showErrors={showConsentErrors}
              locale={locale}
              registerFieldRef={registerFieldRef}
            />
          </div>

          <p className="label-sm mb-3 text-center text-secondary">
            {t('payment_obligation_notice')}
          </p>

          {/* ─── Pay button + consent gate ──────────────────────────────────
              F5 fix: capture-phase click handler intercepts the user's
              intent BEFORE the disabled <button> swallows the event, and
              surfaces the consent error explicitly. Keyboard users reach
              this surface via the consent block's own checkboxes which
              individually announce errors via role="alert". */}
          <div
            onClickCapture={handlePayAttemptCapture}
            onKeyDownCapture={(e) => {
              if (!consentReady && (e.key === 'Enter' || e.key === ' ')) {
                handlePayAttemptCapture(e);
              }
            }}
            data-testid="checkout-pay-button-wrapper"
            data-consent-ready={consentReady ? 'true' : 'false'}
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
