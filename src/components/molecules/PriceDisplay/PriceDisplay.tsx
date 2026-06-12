import { toIntlLocale } from '@/lib/helpers/hreflang';

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

const COPY_BY_LOCALE = {
  pl: { free: 'Gratis', from: 'od', to: 'do', price: 'Cena', currencyName: 'złotych', minute: 'min' },
  en: { free: 'Free', from: 'from', to: 'to', price: 'Price', currencyName: 'zlotys', minute: 'min' },
  ua: { free: 'Безкоштовно', from: 'від', to: 'до', price: 'Ціна', currencyName: 'злотих', minute: 'хв' },
  de: { free: 'Gratis', from: 'ab', to: 'bis', price: 'Preis', currencyName: 'Zloty', minute: 'Min.' },
} as const;

function resolveCopy(locale: string) {
  return COPY_BY_LOCALE[locale as keyof typeof COPY_BY_LOCALE] ?? COPY_BY_LOCALE.pl;
}

function formatPLN(amountInCents: number, locale: string): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
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
  const copy = resolveCopy(locale);

  // Build price string
  let priceText: string;
  if (amountInCents === 0) {
    priceText = copy.free;
  } else if (effectiveVariant === 'from') {
    priceText = copy.from + ' ' + formatPLN(amountInCents, locale);
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
        ? copy.from + ' ' + duration + ' ' + copy.minute
        : duration + ' ' + copy.minute;
    durationText = ' \u00B7 ' + durationLabel;
  }

  // aria-label — include range for screen readers
  let ariaLabel: string;
  if (amountInCents === 0) {
    ariaLabel = `${copy.price}: ${copy.free}`;
  } else if (effectiveVariant === 'range' && maxAmountInCents !== undefined) {
    ariaLabel = `${copy.price}: ${copy.from} ${Math.round(amountInCents / 100)} ${copy.to} ${Math.round(maxAmountInCents / 100)} ${copy.currencyName}`;
  } else if (effectiveVariant === 'from') {
    ariaLabel = `${copy.price}: ${copy.from} ${Math.round(amountInCents / 100)} ${copy.currencyName}`;
  } else {
    ariaLabel = `${copy.price}: ${Math.round(amountInCents / 100)} ${copy.currencyName}`;
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
