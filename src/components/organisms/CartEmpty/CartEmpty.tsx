'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export function CartEmpty() {
  const t = useTranslations('cart');

  return (
    <div
      className="col-span-12 flex justify-center py-6 pt-4"
      data-testid="cart-empty"
    >
      <div className="flex w-[466px] flex-col">
        <h2 className="heading-lg text-center text-primary">{t('shopping_cart')}</h2>
        <p className="mt-2 text-center text-lg text-secondary">
          {t('empty_message')}
        </p>
        <LocalizedClientLink
          href="/categories"
          className="mt-6"
        >
          <Button className="flex w-full items-center justify-center py-3">{t('explore_home')}</Button>
        </LocalizedClientLink>
      </div>
    </div>
  );
}
