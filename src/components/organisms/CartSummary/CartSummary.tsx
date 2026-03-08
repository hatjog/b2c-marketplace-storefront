'use client';

import { useTranslations } from 'next-intl';

import { convertToLocale } from '@/lib/helpers/money';

export const CartSummary = ({
  item_total,
  shipping_total,
  total,
  currency_code,
  tax,
  discount_total
}: {
  item_total: number;
  shipping_total: number;
  total: number;
  currency_code: string;
  tax: number;
  discount_total: number;
}) => {
  const t = useTranslations('cart');

  return (
    <div data-testid="cart-summary">
      <div className="label-md mb-4 space-y-4 text-secondary">
        <div
          className="flex justify-between"
          data-testid="cart-summary-items"
        >
          <span>{t('items')}</span>
          <span className="text-primary">
            {convertToLocale({
              amount: item_total,
              currency_code
            })}
          </span>
        </div>
        <div
          className="flex justify-between"
          data-testid="cart-summary-delivery"
        >
          <span>{t('delivery')}</span>
          <span className="text-primary">
            {convertToLocale({
              amount: shipping_total,
              currency_code
            })}
          </span>
        </div>
        <div
          className="flex justify-between"
          data-testid="cart-summary-tax"
        >
          <span>{t('tax')}</span>
          <span className="text-primary">
            {convertToLocale({
              amount: tax,
              currency_code
            })}
          </span>
        </div>
        <div
          className="flex justify-between"
          data-testid="cart-summary-discount"
        >
          <span>{t('discount')}</span>
          <span className="text-primary">
            {convertToLocale({
              amount: discount_total,
              currency_code
            })}
          </span>
        </div>
        <div
          className="flex items-center justify-between border-t pt-4"
          data-testid="cart-summary-total"
        >
          <span>{t('total')}</span>
          <span className="label-xl text-primary">
            {convertToLocale({
              amount: total,
              currency_code
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
