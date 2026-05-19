'use client';

import { useTranslations } from 'next-intl';

import { convertToLocale } from '@/lib/helpers/money';

export const CartSummary = ({
  item_total,
  shipping_total,
  total,
  currency_code,
  tax,
  discount_total,
  deliveryMethod,
  onDeliveryMethodChange,
  showEnhancedCartSummary = false
}: {
  item_total: number;
  shipping_total: number;
  total: number;
  currency_code: string;
  tax: number;
  discount_total: number;
  deliveryMethod?: 'pdf_email' | 'scheduled';
  onDeliveryMethodChange?: (value: 'pdf_email' | 'scheduled') => void;
  showEnhancedCartSummary?: boolean;
}) => {
  const t = useTranslations('cart');

  return (
    <div data-testid="cart-summary">
      <div className="label-md mb-4 space-y-4 text-secondary">
        <div
          className="flex justify-between"
          data-testid="cart-summary-items"
        >
          <span>{showEnhancedCartSummary ? t('summary_subtotal') : t('items')}</span>
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
        {showEnhancedCartSummary && (
          <div
            className="space-y-2"
            data-testid="cart-summary-delivery-method"
          >
            <p className="text-primary">{t('delivery_method_label')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-3 py-2">
                <input
                  type="radio"
                  name="delivery-method"
                  value="pdf_email"
                  checked={deliveryMethod === 'pdf_email'}
                  onChange={() => onDeliveryMethodChange?.('pdf_email')}
                />
                <span>{t('delivery_method_pdf_email')}</span>
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-3 py-2">
                <input
                  type="radio"
                  name="delivery-method"
                  value="scheduled"
                  checked={deliveryMethod === 'scheduled'}
                  onChange={() => onDeliveryMethodChange?.('scheduled')}
                />
                <span>{t('delivery_method_scheduled')}</span>
              </label>
            </div>
          </div>
        )}
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
