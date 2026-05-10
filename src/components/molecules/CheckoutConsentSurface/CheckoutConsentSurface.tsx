'use client';

/**
 * CheckoutConsentSurface — inline checkout consent affirmations.
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Renders the transactional consent (FR60) and consumer withdrawal acknowledgement
 * (FR64) at the checkout review step. These must be visible and checkable at
 * submit time — NOT modal-only (anti-pattern per Story 2.4 Dev Notes).
 *
 * FR60: transactional consent — order/customer-flow events are collected.
 * FR64: consumer withdrawal policy states:
 *   withdrawal-eligible-before-service-execution
 *   consent-to-execute-captured
 *   withdrawal-blocked-after-execution
 *   refunded
 *   support-review
 *
 * Rules:
 *   - Neither checkbox is pre-checked (active opt-in; GDPR Art. 7 / RODO).
 *   - Both checkboxes must be checked before submit CTA activates (or caller is blocked).
 *   - Marketing opt-in MUST NOT be bundled here (NFR23 — transactional only in v1.7.0).
 *   - Links to legal copy live in Story 2.9 surfaces (/zasady, /polityka-prywatnosci).
 *   - Raw legal copy is NOT duplicated here — only short affirmation text + link.
 *   - Focus management: field-linked errors on aria-describedby.
 *
 * WCAG 2.1 AA:
 *   - Checkboxes: min 44px touch target (size-6 = 24px box + label click area).
 *   - aria-describedby links checkbox to withdrawal-policy link text.
 *   - error role for required-but-unchecked state.
 *
 * ARCH-007: Customer-facing storefront only.
 */

import React, { useId } from 'react';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface CheckoutConsentSurfaceProps {
  /** Whether the transactional consent checkbox is checked. */
  transactionalConsentChecked: boolean;
  /** Whether the withdrawal acknowledgement checkbox is checked. */
  withdrawalAckChecked: boolean;
  /** Called when transactional consent changes. */
  onTransactionalConsentChange: (checked: boolean) => void;
  /** Called when withdrawal acknowledgement changes. */
  onWithdrawalAckChange: (checked: boolean) => void;
  /** Whether to show validation error state (both required for submit). */
  showErrors?: boolean;
  /**
   * Locale for localized links.
   *
   * F16 review fix: required prop (no default). Callers MUST pass an active
   * locale so EN/UA/DE customers do not silently receive PL legal links.
   * The actual route slugs (`zasady`, `polityka-prywatnosci`) are still
   * Polish for v1.7.0; locale-aware route slugs are deferred to Story 2.9.
   */
  locale: string;
  /** Additional class names. */
  className?: string;
  /**
   * Optional ref-callback for focus management (F6/F7 review fix).
   * Receives the field name ("transactional" | "withdrawal") and the
   * checkbox element so the parent's useFormErrors hook can register
   * refs for focus-first-error.
   */
  registerFieldRef?: (fieldName: 'transactional' | 'withdrawal') => (el: HTMLElement | null) => void;
}

export function CheckoutConsentSurface({
  transactionalConsentChecked,
  withdrawalAckChecked,
  onTransactionalConsentChange,
  onWithdrawalAckChange,
  showErrors = false,
  locale,
  className,
  registerFieldRef,
}: CheckoutConsentSurfaceProps) {
  const t = useTranslations('checkout.consent');
  const transId = useId();
  const withdrawalId = useId();
  const transErrorId = useId();
  const withdrawalErrorId = useId();

  const legalHref = `/${locale}/zasady`;
  const privacyHref = `/${locale}/polityka-prywatnosci`;
  const withdrawalHref = `/${locale}/zasady#prawo-odst%C4%85pienia`;

  const showTransError = showErrors && !transactionalConsentChecked;
  const showWithdrawalError = showErrors && !withdrawalAckChecked;

  return (
    <div
      className={className}
      data-testid="checkout-consent-surface"
    >
      {/* ─── Transactional consent (FR60) ─────────────────────────────────── */}
      <div
        className="space-y-2"
        data-testid="checkout-consent-transactional"
      >
        <label
          htmlFor={transId}
          className="flex cursor-pointer items-start gap-3 text-sm"
        >
          {/* min 44px touch area: size-5 box + padding + label click area covers it */}
          <input
            id={transId}
            type="checkbox"
            checked={transactionalConsentChecked}
            onChange={(e) => onTransactionalConsentChange(e.target.checked)}
            aria-required="true"
            aria-describedby={showTransError ? transErrorId : undefined}
            aria-invalid={showTransError || undefined}
            data-testid="checkout-consent-transactional-checkbox"
            ref={registerFieldRef?.('transactional')}
            className="mt-0.5 size-5 flex-shrink-0 cursor-pointer rounded accent-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
          <span className="label-sm text-primary leading-relaxed">
            {t('transactional_label')}{' '}
            <Link
              href={privacyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              data-testid="checkout-consent-privacy-link"
            >
              {t('transactional_privacy_link')}
            </Link>
          </span>
        </label>

        {showTransError && (
          <p
            id={transErrorId}
            role="alert"
            className="label-sm ml-8 text-[var(--color-error)]"
            data-testid="checkout-consent-transactional-error"
          >
            {t('transactional_required_error')}
          </p>
        )}
      </div>

      {/* ─── Withdrawal acknowledgement (FR64) ───────────────────────────── */}
      <div
        className="mt-3 space-y-2"
        data-testid="checkout-consent-withdrawal"
      >
        <label
          htmlFor={withdrawalId}
          className="flex cursor-pointer items-start gap-3 text-sm"
        >
          <input
            id={withdrawalId}
            type="checkbox"
            checked={withdrawalAckChecked}
            onChange={(e) => onWithdrawalAckChange(e.target.checked)}
            aria-required="true"
            aria-describedby={showWithdrawalError ? withdrawalErrorId : undefined}
            aria-invalid={showWithdrawalError || undefined}
            data-testid="checkout-consent-withdrawal-checkbox"
            ref={registerFieldRef?.('withdrawal')}
            className="mt-0.5 size-5 flex-shrink-0 cursor-pointer rounded accent-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
          <span className="label-sm text-primary leading-relaxed">
            {t('withdrawal_label')}{' '}
            <Link
              href={withdrawalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              data-testid="checkout-consent-withdrawal-link"
            >
              {t('withdrawal_policy_link')}
            </Link>
          </span>
        </label>

        {showWithdrawalError && (
          <p
            id={withdrawalErrorId}
            role="alert"
            className="label-sm ml-8 text-[var(--color-error)]"
            data-testid="checkout-consent-withdrawal-error"
          >
            {t('withdrawal_required_error')}
          </p>
        )}
      </div>

      {/* ─── Withdrawal policy status note ────────────────────────────────── */}
      <p
        className="mt-3 label-sm text-secondary"
        data-testid="checkout-consent-withdrawal-status"
      >
        {t('withdrawal_status_note')}{' '}
        <Link
          href={legalHref}
          className="underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          data-testid="checkout-consent-legal-link"
        >
          {t('withdrawal_status_link')}
        </Link>
      </p>
    </div>
  );
}
