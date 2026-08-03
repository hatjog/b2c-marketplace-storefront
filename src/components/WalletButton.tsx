'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';

import deMessages from '../../messages/de.json';
import enMessages from '../../messages/en.json';
import plMessages from '../../messages/pl.json';
import uaMessages from '../../messages/ua.json';

// Provider-neutral kind aligned with `@gp/wallet` (Story 3.1). Workspace package
// `@gp/wallet` is not wired into storefront (see Story 3.5 KNOWN_GAP F-19/F-01);
// local type kept until alias lands to avoid cross-submodule relative import.
export type WalletProviderKind = 'google' | 'apple';

export type WalletButtonLocale = 'pl' | 'en' | 'de' | 'ua';

type WalletButtonCopy = {
  label: string;
  loadingLabel: string;
  ariaLabel: string;
  successToast: string;
  errorToast: string;
  retryLabel: string;
};

const MESSAGES_BY_LOCALE = {
  pl: plMessages,
  en: enMessages,
  de: deMessages,
  ua: uaMessages,
} as const;

const PROVIDER_NAME: Record<WalletProviderKind, string> = {
  google: 'Google Wallet',
  apple: 'Apple Wallet',
};

function buildWalletButtonCopy(
  t: (key: string, values?: Record<string, string>) => string,
  provider: WalletProviderKind,
): WalletButtonCopy {
  const providerName = PROVIDER_NAME[provider];

  return {
    label: t('save.label', { provider: providerName }),
    loadingLabel: t('save.loading_label'),
    ariaLabel: t('save.aria_label', { provider: providerName }),
    successToast: t('save.success_toast', { provider: providerName }),
    errorToast: t('save.error_toast', { provider: providerName }),
    retryLabel: t('save.retry_label'),
  };
}

export type WalletSaveResult = {
  saveUrl: string;
};

export function getWalletButtonCopy(
  locale: WalletButtonLocale,
  provider: WalletProviderKind,
): WalletButtonCopy {
  const t = createTranslator({
    locale,
    messages: MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE.pl,
    namespace: 'wallet',
  });
  return buildWalletButtonCopy(t, provider);
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
    if (!payload.saveUrl) {
      throw new Error('Wallet save response did not include a save URL');
    }
    if (input.provider === 'google' && !payload.saveUrl.startsWith('https://pay.google.com/gp/v/save/')) {
      throw new Error('Google Wallet save URL did not match the expected scheme');
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
  locale: _locale,
  disabled = false,
  className,
}: WalletButtonProps) {
  const t = useTranslations('wallet');
  const copy = useMemo(() => buildWalletButtonCopy(t, provider), [provider, t]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
    },
    [],
  );

  const save = async () => {
    setIsLoading(true);
    setHasError(false);
    setToast(null);
    if (dismissRef.current) clearTimeout(dismissRef.current);

    try {
      // TODO(story-3.7): emit `pass_saved` telemetry to PostHog.
      const result = await requestWalletSave({ voucherCode, provider });
      // Skip success toast: redirect to provider save URL is the AC1 confirmation.
      window.location.assign(result.saveUrl);
    } catch {
      // TODO(story-3.7): emit `pass_failed` telemetry to PostHog with reason.
      setHasError(true);
      setToast(copy.errorToast);
      dismissRef.current = setTimeout(() => setToast(null), 8000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-2">
      <button
        type="button"
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
          className="rounded-[var(--radius-md)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]"
        >
          <span>{toast}</span>
          {hasError && (
            <button
              type="button"
              className="ml-2 inline-flex min-h-11 min-w-11 items-center justify-center px-3 py-2 font-medium text-[var(--bg-action)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-action)]"
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
