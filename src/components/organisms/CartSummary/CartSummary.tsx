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
  deliveryName = 'delivery-method',
  testIdSuffix,
  showEnhancedCartSummary = false
}: {
  item_total: number;
  shipping_total: number;
  total: number;
  currency_code: string;
  tax: number;
  discount_total: number;
  deliveryMethod?: 'pdf_email' | 'magic_link' | 'physical_card';
  onDeliveryMethodChange?: (value: 'pdf_email' | 'magic_link' | 'physical_card') => void;
  deliveryName?: string;
  /** Optional suffix ('desktop' | 'mobile') appended to data-testid to avoid duplicate
   *  testids when both the desktop aside and mobile drawer are mounted simultaneously. */
  testIdSuffix?: string;
  showEnhancedCartSummary?: boolean;
}) => {
  const suffix = testIdSuffix ? `-${testIdSuffix}` : '';
  const t = useTranslations('cart');
  const deliveryOptions = [
    { value: 'pdf_email' as const, label: t('delivery_method_pdf_email') },
    { value: 'magic_link' as const, label: t('delivery_method_magic_link') },
    { value: 'physical_card' as const, label: t('delivery_method_physical_card') }
  ];

  return (
    <div data-testid={`cart-summary${suffix}`}>
      <div className="label-md mb-4 space-y-4 text-secondary">
        <div
          className="flex justify-between"
          data-testid={`cart-summary-items${suffix}`}
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
          data-testid={`cart-summary-delivery${suffix}`}
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
          data-testid={`cart-summary-tax${suffix}`}
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
          data-testid={`cart-summary-discount${suffix}`}
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
            data-testid={`cart-summary-delivery-method${suffix}`}
          >
            <p className="text-primary">{t('delivery_method_label')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {deliveryOptions.map(option => (
                <label
                  key={option.value}
                  className="dchip rchip flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-3 py-2 text-sm has-[:checked]:border-[var(--bb-gold,#C5A059)] has-[:checked]:bg-[var(--bb-tint-gold-12)]"
                >
                  <input
                    type="radio"
                    name={deliveryName}
                    value={option.value}
                    checked={deliveryMethod === option.value}
                    onChange={() => onDeliveryMethodChange?.(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div
          className="sum-total flex items-center justify-between border-t pt-4"
          data-testid={`cart-summary-total${suffix}`}
        >
          <div>
            <span>{t('total')}</span>
            <p className="text-xs text-secondary">{t('vat_included')}</p>
          </div>
          <span className="label-xl text-primary">
            {convertToLocale({
              amount: total,
              currency_code
            })}
          </span>
        </div>
        <div
          className="sum-trust space-y-1 text-xs text-secondary"
          data-testid={`cart-summary-trust${suffix}`}
        >
          <p>{t('trust_line_stripe')}</p>
          <p>{t('trust_line_returns')}</p>
          <p>{t('trust_line_pdf')}</p>
        </div>
      </div>
    </div>
  );
};
