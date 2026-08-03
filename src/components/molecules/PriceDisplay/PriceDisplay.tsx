import { createTranslator } from 'next-intl';

import deMessages from '@/../messages/de.json';
import enMessages from '@/../messages/en.json';
import plMessages from '@/../messages/pl.json';
import uaMessages from '@/../messages/ua.json';
import { toIntlLocale } from '@/lib/helpers/hreflang';
import { convertToLocale } from '@/lib/helpers/money';

type PriceDisplayBase = {
  amountInCents: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showDuration?: boolean;
  duration?: number | null;
  className?: string;
  locale?: string;
};

export type PriceDisplayProps = PriceDisplayBase &
  (
    | { variant?: 'default' | 'from'; maxAmountInCents?: never }
    | { variant: 'range'; maxAmountInCents: number }
  );

const PRICE_DISPLAY_MESSAGES_BY_LOCALE = {
  pl: plMessages,
  en: enMessages,
  ua: uaMessages,
  de: deMessages,
} as const;

function resolveTranslator(locale: string) {
  const messages =
    PRICE_DISPLAY_MESSAGES_BY_LOCALE[locale as keyof typeof PRICE_DISPLAY_MESSAGES_BY_LOCALE] ??
    PRICE_DISPLAY_MESSAGES_BY_LOCALE.pl;

  return createTranslator({
    locale,
    messages,
    namespace: 'common.price_display',
  });
}

function formatPLN(amountInCents: number, locale: string): string {
  // Single source of truth for the PLN convention ("260 zł", whole amounts drop the
  // .00) — see convertToLocale. Always renders the "zł" suffix regardless of the UI
  // language (previously en/ua/de rendered "PLN 200").
  return convertToLocale({
    amount: amountInCents,
    currency_code: 'PLN',
    locale: toIntlLocale(locale),
    isMinorUnit: true,
  });
}

function formatRaw(amountInCents: number, locale: string): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}

export function PriceDisplay({
  amountInCents,
  maxAmountInCents,
  variant = 'default',
  size = 'md',
  showDuration = false,
  duration,
  className,
  locale = 'pl',
}: PriceDisplayProps) {
  if (amountInCents === null || amountInCents === undefined || amountInCents < 0) {
    return null;
  }

  const SIZE_CLASSES = {
    sm: 'text-xs font-medium leading-tight',
    md: 'text-sm font-medium leading-tight',
    lg: 'text-2xl font-medium leading-tight',
  } as const;
  const sizeClass = SIZE_CLASSES[size];

  // Resolve effective variant (range with equal min/max → default)
  const effectiveVariant =
    variant === 'range' && amountInCents === maxAmountInCents ? 'default' : variant;
  const t = resolveTranslator(locale);

  // Build price string
  let priceText: string;
  if (amountInCents === 0) {
    priceText = t('free');
  } else if (effectiveVariant === 'from') {
    priceText = t('from') + ' ' + formatPLN(amountInCents, locale);
  } else if (effectiveVariant === 'range' && maxAmountInCents !== undefined) {
    priceText = formatRaw(amountInCents, locale) + '\u2013' + formatPLN(maxAmountInCents, locale);
  } else {
    priceText = formatPLN(amountInCents, locale);
  }

  // Build duration suffix
  let durationText = '';
  if (showDuration && duration !== null && duration !== undefined) {
    const durationLabel =
      effectiveVariant === 'from'
        ? t('from') + ' ' + duration + ' ' + t('minute')
        : duration + ' ' + t('minute');
    durationText = ' \u00B7 ' + durationLabel;
  }

  // aria-label — include range for screen readers.
  // Uses formatPLN() so the currency token is consistent with the visible text
  // (e.g. "200 zł" for pl, "PLN 200" for en, "200 PLN" for de/ua).
  let ariaLabel: string;
  if (amountInCents === 0) {
    ariaLabel = `${t('price')}: ${t('free')}`;
  } else if (effectiveVariant === 'range' && maxAmountInCents !== undefined) {
    ariaLabel = `${t('price')}: ${t('from')} ${formatPLN(amountInCents, locale)} ${t('to')} ${formatPLN(maxAmountInCents, locale)}`;
  } else if (effectiveVariant === 'from') {
    ariaLabel = `${t('price')}: ${t('from')} ${formatPLN(amountInCents, locale)}`;
  } else {
    ariaLabel = `${t('price')}: ${formatPLN(amountInCents, locale)}`;
  }

  return (
    <span
      className={[sizeClass, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
    >
      {priceText}
      {durationText}
    </span>
  );
}
