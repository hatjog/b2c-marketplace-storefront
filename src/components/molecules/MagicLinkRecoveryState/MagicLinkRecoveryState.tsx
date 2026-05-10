/**
 * MagicLinkRecoveryState — Story 2.6 (v1.7.0).
 *
 * Neutral error state for expired, already-used or malformed magic-link
 * recovery tokens. Intentionally anti-enumeration: single i18n copy
 * (voucher.recovery.error.neutral) for ALL failure reasons so no
 * token-existence information is leaked (NFR16 + Anti-pattern: PII in URL).
 *
 * DS boundary (ARCH-007): customer-facing storefront only.
 * Reuses StateCard (Story 2.1) + BonBeauty surface tokens.
 * WCAG 2.1 AA: visible focus on CTA, error role for SR announcement.
 */
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { StateCard } from '@/components/molecules/StateCard/StateCard';
import {
  requestVoucherRecoveryLink,
  requestVoucherRecoveryLinkForm
} from '@/actions/voucher-recovery';

interface MagicLinkRecoveryStateProps {
  locale: string;
  'data-testid'?: string;
}

/**
 * Renders the neutral error state for a failed/expired magic-link recovery.
 *
 * Provides a "request new link" form using the email-pass identity provider.
 * Anti-enumeration: after submission, always shows the same success copy
 * regardless of whether the email exists (voucher.recovery.cta.request_new_link).
 *
 * Referrer-Policy: set at route level (page.tsx metadata), not here.
 * Token is NEVER passed to this component — it stays in the route handler.
 */
export function MagicLinkRecoveryState({
  locale,
  'data-testid': dataTestId = 'magic-link-recovery-state',
}: MagicLinkRecoveryStateProps) {
  const t = useTranslations('voucher.recovery');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      await requestVoucherRecoveryLink(email);
      setSubmitted(true);
    });
  }

  const action = submitted ? (
    <p
      className="text-sm text-secondary"
      role="status"
      aria-live="polite"
      data-testid="recovery-sent-confirmation"
    >
      {t('sent_confirmation')}
    </p>
  ) : (
    // Progressive enhancement (Story 2.6 re-review MEDIUM, M-no-js):
    //   - `action={requestVoucherRecoveryLinkForm}` is the no-JS path; the
    //     Server Action handles the request and redirects to the neutral
    //     `/recover?sent=1` route so JS-disabled clients still complete the
    //     flow (mirrors v1.5.0 voucher/consent baseline).
    //   - `onSubmit={handleSubmit}` runs only when JS is available; it
    //     prevents the navigation, exercises the inline success copy and
    //     keeps the user on the page.
    <form
      action={requestVoucherRecoveryLinkForm}
      method="POST"
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-3"
      aria-label={t('cta_request_new_link')}
    >
      <input type="hidden" name="locale" value={locale} />
      <label
        htmlFor={`recovery-email-${locale}`}
        className="sr-only"
      >
        {t('email_label')}
      </label>
      <input
        id={`recovery-email-${locale}`}
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        placeholder={t('email_placeholder')}
        className="min-h-12 rounded-sm border border-primary bg-primary px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-action"
        aria-required="true"
      />
      <button
        type="submit"
        className="min-h-12 rounded-sm bg-action px-6 py-3 text-action-on-primary font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action"
        data-testid="recovery-request-link-cta"
      >
        {t('cta_request_new_link')}
      </button>
    </form>
  );

  return (
    <div data-testid={dataTestId}>
      <StateCard
        variant="error"
        title={t('error_neutral_heading')}
        titleAs="h2"
        description={t('error_neutral')}
        action={action}
        data-testid="magic-link-recovery-state-card"
      />
    </div>
  );
}
