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

/** Returns true when a cart line item is out-of-stock (mirrors CartItemsProducts logic). */
function isLineItemOutOfStock(item: HttpTypes.StoreCartLineItem): boolean {
  const metadata = item.metadata as Record<string, unknown> | null | undefined;
  const variant = item.variant as
    | (HttpTypes.StoreProductVariant & {
        inventory_quantity?: number | null;
        manage_inventory?: boolean | null;
        allow_backorder?: boolean | null;
      })
    | null
    | undefined;
  const availability = String(
    metadata?.availability ?? metadata?.stock_status ?? metadata?.['gp.availability'] ?? ''
  ).toLowerCase();

  if (
    metadata?.out_of_stock === true ||
    availability === 'out_of_stock' ||
    availability === 'unavailable'
  ) {
    return true;
  }

  if (metadata?.in_stock === false) {
    return true;
  }

  if (variant?.manage_inventory === false || variant?.allow_backorder === true) {
    return false;
  }

  return typeof variant?.inventory_quantity === 'number' && variant.inventory_quantity <= 0;
}

/** Compute cart total excluding OOS items (AC3: recalculate). */
function computeAvailableTotal(cart: HttpTypes.StoreCart): number {
  const items = cart.items ?? [];
  const oosSubtotal = items
    .filter(item => isLineItemOutOfStock(item))
    .reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
  return Math.max(0, (cart.total ?? 0) - oosSubtotal);
}

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
  // AC3: total shown excludes OOS items (recalculate presentation).
  const availableTotal = cart ? computeAvailableTotal(cart) : 0;
  const totalFormatted = convertToLocale({
    amount: availableTotal,
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

  // M2: renderSummary accepts a testIdSuffix to disambiguate duplicate testids
  // between the desktop aside and the mobile drawer (both share the same DOM tree).
  const renderSummary = (deliveryName: string, testIdSuffix: 'desktop' | 'mobile') => (
    <>
      <div
        className="discount-block mb-5 space-y-3"
        data-testid={`cart-discount-block-${testIdSuffix}`}
      >
        <PromoCode
          cart={cart}
          defaultOpen
        />
        <button
          type="button"
          className="flex min-h-[52px] w-full items-center justify-between rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-4 py-3 text-left text-sm font-medium text-primary"
          data-testid={`cart-gift-card-option-${testIdSuffix}`}
        >
          <span>{t('gift_card_option')}</span>
          <span className="text-secondary">{t('another_step_appears')}</span>
        </button>
      </div>
      <CartSummary
        item_total={cart?.item_subtotal || 0}
        shipping_total={cart?.shipping_subtotal || 0}
        total={availableTotal}
        currency_code={cart?.currency_code || ''}
        tax={cart?.tax_total || 0}
        discount_total={cart?.discount_subtotal || 0}
        deliveryMethod={deliveryMethod}
        onDeliveryMethodChange={setDeliveryMethod}
        deliveryName={deliveryName}
        testIdSuffix={testIdSuffix}
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
            {renderSummary('cart-delivery-method-desktop', 'desktop')}
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
          {renderSummary('cart-delivery-method-mobile', 'mobile')}
        </div>
      </details>
    </div>
  );
};
