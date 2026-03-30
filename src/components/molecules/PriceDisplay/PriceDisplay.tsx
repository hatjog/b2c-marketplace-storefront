export interface PriceDisplayProps {
  amountInCents: number | null | undefined;
  maxAmountInCents?: number;
  variant?: 'default' | 'from' | 'range';
  size?: 'sm' | 'md' | 'lg';
  showDuration?: boolean;
  duration?: number | null;
  className?: string;
}

function formatPLN(amountInCents: number): string {
  return (amountInCents / 100).toLocaleString('pl-PL') + ' zł';
}

export function PriceDisplay({
  amountInCents,
  maxAmountInCents,
  variant = 'default',
  size = 'md',
  showDuration = false,
  duration,
  className,
}: PriceDisplayProps) {
  if (amountInCents === null || amountInCents === undefined) {
    return null;
  }

  const sizeClass =
    size === 'lg'
      ? 'text-2xl font-medium leading-tight'
      : 'text-sm font-medium leading-tight';

  // Resolve effective variant (range with equal min/max → default)
  const effectiveVariant =
    variant === 'range' && amountInCents === maxAmountInCents ? 'default' : variant;

  // Build price string
  let priceText: string;
  if (amountInCents === 0) {
    priceText = 'Gratis';
  } else if (effectiveVariant === 'from') {
    priceText = 'od ' + formatPLN(amountInCents);
  } else if (effectiveVariant === 'range' && maxAmountInCents !== undefined) {
    priceText =
      formatPLN(amountInCents).replace(' zł', '') +
      '\u2013' +
      formatPLN(maxAmountInCents);
  } else {
    priceText = formatPLN(amountInCents);
  }

  // Build duration suffix
  let durationText = '';
  if (showDuration && duration !== null && duration !== undefined) {
    const durationLabel =
      effectiveVariant === 'from' ? 'od ' + duration + ' min' : duration + ' min';
    durationText = ' \u00B7 ' + durationLabel;
  }

  // aria-label
  const ariaLabel =
    amountInCents === 0
      ? 'Cena: Gratis'
      : 'Cena: ' + Math.round(amountInCents / 100) + ' złotych';

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
