'use client';

import { useEffect, useMemo, useState } from 'react';

import { WalletButton, type WalletButtonLocale } from '../WalletButton';

type SymmetricPossessionCopy = {
  eyebrow: string;
  iphoneSafariEyebrow: string;
  pdfLabel: string;
  pdfAriaLabel: string;
  emailLabel: string;
  emailAriaLabel: string;
  emailLoadingLabel: string;
  emailSuccessToast: string;
  emailErrorToast: string;
};

const COPY: Record<WalletButtonLocale, SymmetricPossessionCopy> = {
  pl: {
    eyebrow: 'Zachowaj voucher jak chcesz — w telefonie, w PDF, lub w mailu',
    iphoneSafariEyebrow: 'Zapisz na telefonie jako PDF — Apple Wallet wkrótce',
    pdfLabel: 'Pobierz PDF',
    pdfAriaLabel: 'Pobierz voucher jako PDF',
    emailLabel: 'Wyślij ponownie na e-mail',
    emailAriaLabel: 'Wyślij voucher ponownie na e-mail',
    emailLoadingLabel: 'Wysyłam...',
    emailSuccessToast: 'Voucher wysłany ponownie na e-mail.',
    emailErrorToast: 'Nie udało się wysłać e-maila. Spróbuj ponownie.',
  },
  en: {
    eyebrow: 'Keep your voucher your way — on your phone, in PDF, or in email',
    iphoneSafariEyebrow: 'Save it on your phone as a PDF — Apple Wallet is coming soon',
    pdfLabel: 'Download PDF',
    pdfAriaLabel: 'Download voucher as PDF',
    emailLabel: 'Send again by email',
    emailAriaLabel: 'Send voucher again by email',
    emailLoadingLabel: 'Sending...',
    emailSuccessToast: 'Voucher sent again by email.',
    emailErrorToast: 'We could not send the email. Try again.',
  },
  de: {
    eyebrow: 'Bewahre deinen Voucher so auf, wie du möchtest — im Telefon, als PDF oder per E-Mail',
    iphoneSafariEyebrow: 'Auf dem Telefon als PDF speichern — Apple Wallet kommt bald',
    pdfLabel: 'PDF herunterladen',
    pdfAriaLabel: 'Voucher als PDF herunterladen',
    emailLabel: 'Erneut per E-Mail senden',
    emailAriaLabel: 'Voucher erneut per E-Mail senden',
    emailLoadingLabel: 'Wird gesendet...',
    emailSuccessToast: 'Voucher wurde erneut per E-Mail gesendet.',
    emailErrorToast: 'Die E-Mail konnte nicht gesendet werden. Versuche es erneut.',
  },
  ua: {
    eyebrow: 'Збережіть ваучер як зручно — у телефоні, PDF або листі',
    iphoneSafariEyebrow: 'Збережіть на телефоні як PDF — Apple Wallet незабаром',
    pdfLabel: 'Завантажити PDF',
    pdfAriaLabel: 'Завантажити ваучер як PDF',
    emailLabel: 'Надіслати ще раз на e-mail',
    emailAriaLabel: 'Надіслати ваучер ще раз на e-mail',
    emailLoadingLabel: 'Надсилаємо...',
    emailSuccessToast: 'Ваучер повторно надіслано на e-mail.',
    emailErrorToast: 'Не вдалося надіслати e-mail. Спробуйте ще раз.',
  },
};

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
  return COPY[locale] ?? COPY.pl;
}

export function getEmailResendEndpoint(voucherCode: string): string {
  return `/store/voucher/${encodeURIComponent(voucherCode)}/email`;
}

export type SymmetricPossessionSectionProps = {
  voucherCode: string;
  locale: WalletButtonLocale;
  pdfHref: string;
  className?: string;
};

export function SymmetricPossessionSection({
  voucherCode,
  locale,
  pdfHref,
  className,
}: SymmetricPossessionSectionProps) {
  const copy = useMemo(() => getPossessionCopy(locale), [locale]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);
  const [isIphone, setIsIphone] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsIphone(isIphoneSafari(navigator.userAgent));
    }
  }, []);

  const resendEmail = async () => {
    setIsSendingEmail(true);
    setEmailToast(null);

    try {
      const response = await fetch(getEmailResendEndpoint(voucherCode), { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Email resend failed with ${response.status}`);
      }
      setEmailToast(copy.emailSuccessToast);
    } catch {
      setEmailToast(copy.emailErrorToast);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <section
      aria-labelledby="voucher-possession-heading"
      className={[
        'flex flex-col gap-3 rounded-[22px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p id="voucher-possession-heading" className="text-xs uppercase tracking-[0.18em] text-[var(--cta-hover)]">
        {isIphone ? copy.iphoneSafariEyebrow : copy.eyebrow}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <WalletButton voucherCode={voucherCode} provider="google" locale={locale} />
        <a
          href={pdfHref}
          role="button"
          aria-label={copy.pdfAriaLabel}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[var(--bb-border-soft)] bg-white px-5 py-3 text-center text-sm font-medium text-[var(--bg-action)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-action)]"
        >
          {copy.pdfLabel}
        </a>
        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            role="button"
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
              className="rounded-[12px] border border-[var(--bb-border-soft)] bg-white px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]"
            >
              {emailToast}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default SymmetricPossessionSection;
