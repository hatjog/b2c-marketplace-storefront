'use client';

import { useMemo, useState } from 'react';

import type { WalletProviderKind } from '../../../backend/packages/wallet/src';

export type WalletButtonLocale = 'pl' | 'en' | 'de' | 'ua';

type WalletButtonCopy = {
  label: string;
  loadingLabel: string;
  ariaLabel: string;
  successToast: string;
  errorToast: string;
  retryLabel: string;
};

const COPY: Record<WalletButtonLocale, Record<WalletProviderKind, WalletButtonCopy>> = {
  pl: {
    google: {
      label: 'Dodaj do Google Wallet',
      loadingLabel: 'Zapisuję...',
      ariaLabel: 'Dodaj voucher do Google Wallet',
      successToast: 'Voucher zapisany w Google Wallet',
      errorToast: 'Nie udało się zapisać w Google Wallet. Spróbuj ponownie lub zapisz w PDF.',
      retryLabel: 'Spróbuj ponownie',
    },
    apple: {
      label: 'Dodaj do Apple Wallet',
      loadingLabel: 'Zapisuję...',
      ariaLabel: 'Dodaj voucher do Apple Wallet',
      successToast: 'Voucher zapisany w Apple Wallet',
      errorToast: 'Nie udało się zapisać w Apple Wallet. Spróbuj ponownie lub zapisz w PDF.',
      retryLabel: 'Spróbuj ponownie',
    },
  },
  en: {
    google: {
      label: 'Add to Google Wallet',
      loadingLabel: 'Saving...',
      ariaLabel: 'Add voucher to Google Wallet',
      successToast: 'Voucher saved in Google Wallet',
      errorToast: 'We could not save it in Google Wallet. Try again or save it as a PDF.',
      retryLabel: 'Try again',
    },
    apple: {
      label: 'Add to Apple Wallet',
      loadingLabel: 'Saving...',
      ariaLabel: 'Add voucher to Apple Wallet',
      successToast: 'Voucher saved in Apple Wallet',
      errorToast: 'We could not save it in Apple Wallet. Try again or save it as a PDF.',
      retryLabel: 'Try again',
    },
  },
  de: {
    google: {
      label: 'Zu Google Wallet hinzufügen',
      loadingLabel: 'Wird gespeichert...',
      ariaLabel: 'Voucher zu Google Wallet hinzufügen',
      successToast: 'Voucher in Google Wallet gespeichert',
      errorToast: 'Der Voucher konnte nicht in Google Wallet gespeichert werden. Versuche es erneut oder speichere ihn als PDF.',
      retryLabel: 'Erneut versuchen',
    },
    apple: {
      label: 'Zu Apple Wallet hinzufügen',
      loadingLabel: 'Wird gespeichert...',
      ariaLabel: 'Voucher zu Apple Wallet hinzufügen',
      successToast: 'Voucher in Apple Wallet gespeichert',
      errorToast: 'Der Voucher konnte nicht in Apple Wallet gespeichert werden. Versuche es erneut oder speichere ihn als PDF.',
      retryLabel: 'Erneut versuchen',
    },
  },
  ua: {
    google: {
      label: 'Додати до Google Wallet',
      loadingLabel: 'Зберігаємо...',
      ariaLabel: 'Додати ваучер до Google Wallet',
      successToast: 'Ваучер збережено в Google Wallet',
      errorToast: 'Не вдалося зберегти ваучер у Google Wallet. Спробуйте ще раз або збережіть PDF.',
      retryLabel: 'Спробувати ще раз',
    },
    apple: {
      label: 'Додати до Apple Wallet',
      loadingLabel: 'Зберігаємо...',
      ariaLabel: 'Додати ваучер до Apple Wallet',
      successToast: 'Ваучер збережено в Apple Wallet',
      errorToast: 'Не вдалося зберегти ваучер в Apple Wallet. Спробуйте ще раз або збережіть PDF.',
      retryLabel: 'Спробувати ще раз',
    },
  },
};

export type WalletSaveResult = {
  saveUrl: string;
};

export function getWalletButtonCopy(
  locale: WalletButtonLocale,
  provider: WalletProviderKind,
): WalletButtonCopy {
  return COPY[locale]?.[provider] ?? COPY.pl[provider];
}

export function getWalletEndpoint(voucherCode: string): string {
  return `/store/voucher/${encodeURIComponent(voucherCode)}/wallet`;
}

export async function requestWalletSave(input: {
  voucherCode: string;
  provider: WalletProviderKind;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<WalletSaveResult> {
  const fetcher = input.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 5000);

  try {
    const response = await fetcher(getWalletEndpoint(input.voucherCode), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: input.provider }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Wallet save failed with ${response.status}`);
    }

    const payload = (await response.json()) as Partial<WalletSaveResult>;
    if (!payload.saveUrl || !payload.saveUrl.startsWith('https://pay.google.com/gp/v/save/')) {
      throw new Error('Wallet save response did not include a Google Wallet save URL');
    }

    return { saveUrl: payload.saveUrl };
  } finally {
    clearTimeout(timeout);
  }
}

export type WalletButtonProps = {
  voucherCode: string;
  provider: WalletProviderKind;
  locale: WalletButtonLocale;
  disabled?: boolean;
  className?: string;
};

export function WalletButton({
  voucherCode,
  provider,
  locale,
  disabled = false,
  className,
}: WalletButtonProps) {
  const copy = useMemo(() => getWalletButtonCopy(locale, provider), [locale, provider]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const save = async () => {
    setIsLoading(true);
    setHasError(false);
    setToast(null);

    try {
      const result = await requestWalletSave({ voucherCode, provider });
      setToast(copy.successToast);
      window.location.assign(result.saveUrl);
    } catch {
      setHasError(true);
      setToast(copy.errorToast);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-2">
      <button
        type="button"
        role="button"
        aria-label={copy.ariaLabel}
        aria-busy={isLoading}
        disabled={disabled || isLoading}
        onClick={save}
        className={[
          'inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[var(--bb-border-soft)] bg-white px-5 py-3 text-center text-sm font-medium text-[var(--bg-action)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-action)] disabled:cursor-not-allowed disabled:opacity-70',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isLoading && (
          <span
            aria-hidden="true"
            className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {isLoading ? copy.loadingLabel : copy.label}
      </button>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[12px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]"
        >
          <span>{toast}</span>
          {hasError && (
            <button
              type="button"
              className="ml-2 font-medium text-[var(--bg-action)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-action)]"
              onClick={save}
            >
              {copy.retryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default WalletButton;
