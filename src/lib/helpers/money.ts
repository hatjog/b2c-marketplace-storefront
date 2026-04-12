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
  }).resolvedOptions().maximumFractionDigits;
}

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = 'en-US',
  isMinorUnit = true,
}: ConvertToLocaleParams) => {
  return currency_code && !isEmpty(currency_code)
    ? new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency_code,
        minimumFractionDigits,
        maximumFractionDigits
      }).format(
        isMinorUnit
          ? amount / Math.pow(10, getCurrencyFractionDigits(currency_code, locale))
          : amount
      )
    : amount.toString();
};
