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
  return currency_code && !isEmpty(currency_code)
    ? new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency_code,
        minimumFractionDigits,
        maximumFractionDigits
      }).format(
        isMinorUnit
          ? safeAmount / Math.pow(10, getCurrencyFractionDigits(currency_code, locale))
          : safeAmount
      )
    : safeAmount.toString();
};
