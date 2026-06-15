'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';

import { WalletButton, type WalletButtonLocale } from '../WalletButton';
import deMessages from '../../../messages/de.json';
import enMessages from '../../../messages/en.json';
import plMessages from '../../../messages/pl.json';
import uaMessages from '../../../messages/ua.json';

type SymmetricPossessionCopy = {
  eyebrow: string;
  pdfLabel: string;
  pdfAriaLabel: string;
  emailLabel: string;
  emailAriaLabel: string;
  emailLoadingLabel: string;
  emailSuccessToast: string;
  emailErrorToast: string;
};

const MESSAGES_BY_LOCALE = {
  pl: plMessages,
  en: enMessages,
  de: deMessages,
  ua: uaMessages,
} as const;

function buildPossessionCopy(t: (key: string) => string): SymmetricPossessionCopy {
  return {
    eyebrow: t('eyebrow'),
    pdfLabel: t('pdf_label'),
    pdfAriaLabel: t('pdf_aria_label'),
    emailLabel: t('email_label'),
    emailAriaLabel: t('email_aria_label'),
    emailLoadingLabel: t('email_loading_label'),
    emailSuccessToast: t('email_success_toast'),
    emailErrorToast: t('email_error_toast'),
  };
}

export function isIphoneSafari(userAgent: string): boolean {
  return /iphone/i.test(userAgent) && /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
}

export function isAppleWalletEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WALLET_APPLE_ENABLED === 'true';
}

export function shouldRenderAppleWallet(input: {
  provider: 'google' | 'apple';
  appleWalletEnabled?: boolean;
  userAgent?: string;
}): boolean {
  if (input.provider !== 'apple') return true;
  if (!input.appleWalletEnabled) return false;
  return !isIphoneSafari(input.userAgent ?? '');
}

export function getPossessionCopy(locale: WalletButtonLocale): SymmetricPossessionCopy {
  const t = createTranslator({
    locale,
    messages: MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE.pl,
    namespace: 'wallet.possession',
  });
  return buildPossessionCopy(t);
}

export function getEmailResendEndpoint(voucherCode: string): string {
  return `/store/voucher/${encodeURIComponent(voucherCode)}/email`;
}

export type SymmetricPossessionSectionProps = {
  voucherCode: string;
  locale: WalletButtonLocale;
  pdfHref: string;
  className?: string;
  // SSR-resolved UA marker; server passes pre-detected value to avoid hydration mismatch (F-04).
  userAgent?: string;
  // Allows hosting page to disable wallet CTA when entitlement gate denies (F-17).
  walletDisabled?: boolean;
};

export function SymmetricPossessionSection({
  voucherCode,
  locale,
  pdfHref,
  className,
  userAgent,
  walletDisabled = false,
}: SymmetricPossessionSectionProps) {
  const t = useTranslations('wallet.possession');
  const copy = useMemo(() => buildPossessionCopy(t), [t]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);
  const emailDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appleEnabled = isAppleWalletEnabled();
  const renderApple = shouldRenderAppleWallet({
    provider: 'apple',
    appleWalletEnabled: appleEnabled,
    userAgent,
  });

  useEffect(
    () => () => {
      if (emailDismissRef.current) clearTimeout(emailDismissRef.current);
    },
    [],
  );

  const resendEmail = async () => {
    setIsSendingEmail(true);
    setEmailToast(null);
    if (emailDismissRef.current) clearTimeout(emailDismissRef.current);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(getEmailResendEndpoint(voucherCode), {
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Email resend failed with ${response.status}`);
      }
      setEmailToast(copy.emailSuccessToast);
      emailDismissRef.current = setTimeout(() => setEmailToast(null), 6000);
    } catch {
      setEmailToast(copy.emailErrorToast);
      emailDismissRef.current = setTimeout(() => setEmailToast(null), 8000);
    } finally {
      clearTimeout(timer);
      setIsSendingEmail(false);
    }
  };

  return (
    <section
      aria-labelledby="voucher-possession-heading"
      className={[
        'flex flex-col gap-3 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2
        id="voucher-possession-heading"
        className="m-0 text-xs uppercase tracking-[0.18em] text-[var(--cta-hover)]"
      >
        {copy.eyebrow}
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <WalletButton voucherCode={voucherCode} provider="google" locale={locale} disabled={walletDisabled} />
        {renderApple && (
          <WalletButton voucherCode={voucherCode} provider="apple" locale={locale} disabled={walletDisabled} />
        )}
        <div className="flex flex-1 flex-col gap-2">
          <a
            href={pdfHref}
            role="button"
            aria-label={copy.pdfAriaLabel}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[var(--bb-border-soft)] bg-white px-5 py-3 text-center text-sm font-medium text-[var(--bg-action)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-action)]"
          >
            {copy.pdfLabel}
          </a>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            aria-label={copy.emailAriaLabel}
            aria-busy={isSendingEmail}
            onClick={resendEmail}
            disabled={isSendingEmail}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[var(--bb-border-soft)] bg-white px-5 py-3 text-center text-sm font-medium text-[var(--bg-action)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-action)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSendingEmail && (
              <span
                aria-hidden="true"
                className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
            {isSendingEmail ? copy.emailLoadingLabel : copy.emailLabel}
          </button>
          {emailToast && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-[var(--radius-md)] border border-[var(--bb-border-soft)] bg-white px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]"
            >
              {emailToast}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// KNOWN_GAP-Story-3.5-AC4 (F-10): runtime LocaleFallbackNotice integration is deferred —
// wallet copy ships full 4-locale coverage so the AC4 invariant holds by construction.
// Pickup ticket once Story 2.4 component lands & locale gaps appear.

// KNOWN_GAP-Story-3.5-T6 (F-11): jest-axe / vitest-axe harness is not installed in this
// workspace; component test asserts ARIA invariants statically. Full axe coverage is the
// Story 1.8 Playwright runtime axe pass.

export default SymmetricPossessionSection;
