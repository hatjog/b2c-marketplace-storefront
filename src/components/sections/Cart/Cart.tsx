'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { CartEmpty, CartItems, CartSummary } from '@/components/organisms';
import { useCartContext } from '@/components/providers';

export const Cart = () => {
  const { cart } = useCartContext();
  const t = useTranslations('cart');

  if (!cart || !cart.items?.length) {
    return <CartEmpty />;
  }

  return (
    <>
      <div className="col-span-12 lg:col-span-6">
        <CartItems cart={cart} />
      </div>
      <div className="lg:col-span-2"></div>
      <div className="col-span-12 lg:col-span-4">
        <div className="bb-section-shell bb-section-shell-strong h-fit">
          <CartSummary
            item_total={cart?.item_subtotal || 0}
            shipping_total={cart?.shipping_subtotal || 0}
            total={cart?.total || 0}
            currency_code={cart?.currency_code || ''}
            tax={cart?.tax_total || 0}
            discount_total={cart?.discount_subtotal || 0}
          />
          <LocalizedClientLink href="/checkout?step=address">
            <Button className="mt-4 flex w-full items-center justify-center rounded-full bg-[var(--cta)] py-3 text-white hover:bg-[var(--cta-hover)]">{t('go_to_checkout')}</Button>
          </LocalizedClientLink>
        </div>
      </div>
    </>
  );
};
