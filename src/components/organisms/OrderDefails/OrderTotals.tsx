'use client';

import React from 'react';

import { useTranslations } from 'next-intl';

import { convertToLocale } from '@/lib/helpers/money';

type CartTotalsProps = {
  totals: {
    item_total?: number | null;
    total?: number | null;
    shipping_total?: number | null;
    gift_card_total?: number | null;
    currency_code: string;
    shipping_subtotal?: number | null;
  };
};

const OrderTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const t = useTranslations('cart');
  const { item_total, currency_code, total, gift_card_total, shipping_subtotal } = totals;

  return (
    <div className="rounded-sm border bg-white p-4">
      <div className="txt-medium text-ui-fg-subtle flex flex-col gap-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-x-1">{t('items')}</span>
          <span
            data-testid="cart-subtotal"
            data-value={item_total || 0}
          >
            {convertToLocale({ amount: item_total ?? 0, currency_code })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('delivery')}</span>
          <span
            data-testid="cart-shipping"
            data-value={shipping_subtotal || 0}
          >
            {convertToLocale({ amount: shipping_subtotal ?? 0, currency_code })}
          </span>
        </div>
        {!!gift_card_total && (
          <div className="flex items-center justify-between">
            <span>{t('gift_card')}</span>
            <span
              className="text-ui-fg-interactive"
              data-testid="cart-gift-card-amount"
              data-value={gift_card_total || 0}
            >
              - {convertToLocale({ amount: gift_card_total ?? 0, currency_code })}
            </span>
          </div>
        )}
      </div>
      <div className="my-4 h-px w-full border-b border-gray-200" />
      <div className="text-ui-fg-base txt-medium mb-2 flex items-center justify-between">
        <span>{t('total')}</span>
        <span
          className="txt-xlarge-plus"
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
    </div>
  );
};

export default OrderTotals;
