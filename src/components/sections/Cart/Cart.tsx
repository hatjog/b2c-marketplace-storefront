'use client';

import { useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { CartEmpty, CartItems, CartSummary } from '@/components/organisms';
import { PromoCode } from '@/components/organisms/PromoCode/PromoCode';
import { useCartContext } from '@/components/providers';
import { convertToLocale } from '@/lib/helpers/money';
import type { Product } from '@/types/product';

import { CartRecommendations } from './CartRecommendations';

type CuratedCategory = {
  id: string;
  name: string;
  handle: string;
};

export const Cart = ({
  recommendedProducts,
  curatedCategories
}: {
  recommendedProducts: Array<HttpTypes.StoreProduct | Product>;
  curatedCategories: CuratedCategory[];
}) => {
  const { cart } = useCartContext();
  const t = useTranslations('cart');
  const [deliveryMethod, setDeliveryMethod] = useState<
    'pdf_email' | 'magic_link' | 'physical_card'
  >('pdf_email');

  const itemCount = cart?.items?.length ?? 0;
  const totalFormatted = convertToLocale({
    amount: cart?.total ?? 0,
    currency_code: cart?.currency_code ?? 'pln'
  });
  const countSummary = t('count_summary', {
    count: itemCount,
    total: totalFormatted
  });

  if (!cart || !cart.items?.length) {
    return (
      <div className="py-8">
        <header
          className="cart-page-head mb-8"
          data-testid="cart-page-head"
        >
          <h1 className="heading-3xl text-primary">{t('page_heading')}</h1>
          <p className="mt-2 text-sm text-secondary">{countSummary}</p>
        </header>
        <CartEmpty />
      </div>
    );
  }

  const renderSummary = (deliveryName: string) => (
    <>
      <div
        className="discount-block mb-5 space-y-3"
        data-testid="cart-discount-block"
      >
        <PromoCode
          cart={cart}
          defaultOpen
        />
        <button
          type="button"
          className="flex min-h-[52px] w-full items-center justify-between rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-4 py-3 text-left text-sm font-medium text-primary"
          data-testid="cart-gift-card-option"
        >
          <span>{t('gift_card_option')}</span>
          <span className="text-secondary">{t('another_step_appears')}</span>
        </button>
      </div>
      <CartSummary
        item_total={cart?.item_subtotal || 0}
        shipping_total={cart?.shipping_subtotal || 0}
        total={cart?.total || 0}
        currency_code={cart?.currency_code || ''}
        tax={cart?.tax_total || 0}
        discount_total={cart?.discount_subtotal || 0}
        deliveryMethod={deliveryMethod}
        onDeliveryMethodChange={setDeliveryMethod}
        deliveryName={deliveryName}
        showEnhancedCartSummary
      />
      <LocalizedClientLink href="/checkout?step=address">
        <Button className="mt-4 flex w-full items-center justify-center rounded-full bg-[var(--cta)] py-3 text-white hover:bg-[var(--cta-hover)]">
          {t('go_to_checkout')}
        </Button>
      </LocalizedClientLink>
    </>
  );

  return (
    <div className="py-8">
      <header
        className="cart-page-head mb-8"
        data-testid="cart-page-head"
      >
        <h1 className="heading-3xl text-primary">{t('page_heading')}</h1>
        <p className="mt-2 text-sm text-secondary">{countSummary}</p>
      </header>
      <div
        className="cart-layout grid grid-cols-1 gap-8 pb-28 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:pb-0"
        data-testid="cart-layout"
      >
        <div>
          <CartItems
            cart={cart}
            deliveryLabel={t('delivery')}
          />
          <CartRecommendations
            recommendedProducts={recommendedProducts}
            curatedCategories={curatedCategories}
          />
        </div>
        <div className="hidden lg:block">
          <aside
            className="summary-card bb-section-shell bb-section-shell-strong h-fit lg:sticky lg:top-24"
            data-testid="cart-summary-card"
          >
            {renderSummary('cart-delivery-method-desktop')}
          </aside>
        </div>
      </div>
      <details
        className="mobile-summary-drawer fixed inset-x-0 bottom-0 z-40 border-t border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4 shadow-[0_-12px_32px_rgba(27,20,11,0.12)] lg:hidden"
        data-testid="mobile-summary-drawer"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <span className="text-sm font-medium text-secondary">{t('total')}</span>
          <span
            className="sum-total label-xl text-primary"
            data-testid="mobile-summary-total"
          >
            {totalFormatted}
          </span>
        </summary>
        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          {renderSummary('cart-delivery-method-mobile')}
        </div>
      </details>
    </div>
  );
};
