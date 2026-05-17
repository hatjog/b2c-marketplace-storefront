'use client';

import { useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { CartEmpty, CartItems, CartSummary } from '@/components/organisms';
import { PromoCode } from '@/components/organisms/PromoCode/PromoCode';
import { useCartContext } from '@/components/providers';
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
  const [deliveryMethod, setDeliveryMethod] = useState<'pdf_email' | 'scheduled'>('pdf_email');

  if (!cart || !cart.items?.length) {
    return <CartEmpty />;
  }

  return (
    <div className="col-span-12 grid grid-cols-1 gap-8 lg:grid-cols-20">
      <div className="lg:col-span-13">
        <CartItems cart={cart} />
        <CartRecommendations
          recommendedProducts={recommendedProducts}
          curatedCategories={curatedCategories}
        />
      </div>
      <div className="lg:col-span-7">
        <div className="bb-section-shell bb-section-shell-strong h-fit lg:sticky lg:top-24">
          <PromoCode
            cart={cart}
            defaultOpen
          />
          <CartSummary
            item_total={cart?.item_subtotal || 0}
            shipping_total={cart?.shipping_subtotal || 0}
            total={cart?.total || 0}
            currency_code={cart?.currency_code || ''}
            tax={cart?.tax_total || 0}
            discount_total={cart?.discount_subtotal || 0}
            deliveryMethod={deliveryMethod}
            onDeliveryMethodChange={setDeliveryMethod}
            showEnhancedCartSummary
          />
          <p className="mt-4 text-sm text-secondary">{t('trust_microcopy')}</p>
          <LocalizedClientLink href="/checkout?step=address">
            <Button className="mt-4 flex w-full items-center justify-center rounded-full bg-[var(--cta)] py-3 text-white hover:bg-[var(--cta-hover)]">{t('go_to_checkout')}</Button>
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  );
};
