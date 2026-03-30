type PriceDisplayBase = {
  amountInCents: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showDuration?: boolean;
  duration?: number | null;
  className?: string;
};

export type PriceDisplayProps = PriceDisplayBase &
  (
    | { variant?: 'default' | 'from'; maxAmountInCents?: never }
    | { variant: 'range'; maxAmountInCents: number }
  );

function formatPLN(amountInCents: number): string {
  return (amountInCents / 100).toLocaleString('pl-PL') + ' zł';
}

function formatRaw(amountInCents: number): string {
  return (amountInCents / 100).toLocaleString('pl-PL');
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
    priceText = formatRaw(amountInCents) + '\u2013' + formatPLN(maxAmountInCents);
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

  // aria-label — include range for screen readers
  let ariaLabel: string;
  if (amountInCents === 0) {
    ariaLabel = 'Cena: Gratis';
  } else if (effectiveVariant === 'range' && maxAmountInCents !== undefined) {
    ariaLabel = `Cena: od ${Math.round(amountInCents / 100)} do ${Math.round(maxAmountInCents / 100)} złotych`;
  } else if (effectiveVariant === 'from') {
    ariaLabel = `Cena: od ${Math.round(amountInCents / 100)} złotych`;
  } else {
    ariaLabel = `Cena: ${Math.round(amountInCents / 100)} złotych`;
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
