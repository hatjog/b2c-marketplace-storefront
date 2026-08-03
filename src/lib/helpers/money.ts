import { isEmpty } from './isEmpty';

type ConvertToLocaleParams = {
  amount: number;
  currency_code: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  locale?: string;
  isMinorUnit?: boolean;
};

function getCurrencyFractionDigits(currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).resolvedOptions().maximumFractionDigits ?? 2;
}

// Non-breaking space (U+00A0) so the amount and the "zł" suffix never wrap apart —
// matches the typographic behaviour of Intl's currency format.
const NBSP = String.fromCharCode(0xa0);
const PLN_SUFFIX = `${NBSP}z${String.fromCharCode(0x142)}`; // " zł"

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = 'en-US',
  isMinorUnit = true,
}: ConvertToLocaleParams) => {
  // Defensive: a non-finite amount (undefined/null/NaN — e.g. a shipping option
  // without a configured price) must never render as the literal "NaN" / "PLNNaN"
  // in the UI. Coerce to 0 so the formatter yields a valid currency string.
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (!currency_code || isEmpty(currency_code)) {
    return safeAmount.toString();
  }

  const value = isMinorUnit
    ? safeAmount / Math.pow(10, getCurrencyFractionDigits(currency_code, locale))
    : safeAmount;

  // PLN renders in the Polish convention: amount + " zł" suffix (not the "PLN 260.00"
  // currency-code prefix that the en-US default locale produces), and a whole amount
  // drops its .00 → "260 zł" (Robert UX directive). Fractional amounts keep 2 digits
  // ("260,50 zł" / "260.50 zł" per the viewing locale's decimal separator).
  if (currency_code.toUpperCase() === 'PLN') {
    // The whole→0 / fractional→2 rule is unconditional for PLN: callers that pass
    // minimumFractionDigits=2 (e.g. totals columns) must NOT reintroduce a "260.00 zł".
    const isWholeAmount = Math.round(value * 100) % 100 === 0;
    const formatted = new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: isWholeAmount ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${formatted}${PLN_SUFFIX}`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency_code,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};
