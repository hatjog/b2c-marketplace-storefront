'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Badge, Button } from '@/components/atoms';
import { CartDropdownItem, Dropdown } from '@/components/molecules';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { useCartContext } from '@/components/providers';
import { usePrevious } from '@/hooks/usePrevious';
import { CartIcon } from '@/icons';
import { filterValidCartItems } from '@/lib/helpers/filter-valid-cart-items';
import { convertToLocale } from '@/lib/helpers/money';

const getItemCount = (cart: HttpTypes.StoreCart | null) => {
  return cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
};

export const CartDropdown = () => {
  const { cart } = useCartContext();
  const [open, setOpen] = useState(false);
  const t = useTranslations('cart');

  const previousItemCount = usePrevious(getItemCount(cart));
  const cartItemsCount = (cart && getItemCount(cart)) || 0;
  const pathname = usePathname();

  // Filter out items with invalid data (missing prices/variants)
  const validItems = filterValidCartItems(cart?.items);

  const total = convertToLocale({
    amount: cart?.total || 0,
    currency_code: cart?.currency_code || 'eur'
  });

  const delivery = convertToLocale({
    amount: cart?.shipping_subtotal || 0,
    currency_code: cart?.currency_code || 'eur'
  });

  const tax = convertToLocale({
    amount: cart?.tax_total || 0,
    currency_code: cart?.currency_code || 'eur'
  });

  const items = convertToLocale({
    amount: cart?.item_subtotal || 0,
    currency_code: cart?.currency_code || 'eur'
  });

  useEffect(() => {
    if (open) {
      const timeout = setTimeout(() => {
        setOpen(false);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [open]);

  useEffect(() => {
    if (
      previousItemCount !== undefined &&
      cartItemsCount > previousItemCount &&
      pathname.split('/')[2] !== 'cart'
    ) {
      setOpen(true);
    }
  }, [cartItemsCount, previousItemCount]);

  return (
    <div
      className="relative"
      onMouseOver={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <LocalizedClientLink
        href="/cart"
        className="relative"
        aria-label={t('go_to_cart_aria')}
      >
        <CartIcon size={20} />
        {Boolean(cartItemsCount) && (
          <Badge className="absolute -right-2 -top-2 h-4 w-4 p-0">{cartItemsCount}</Badge>
        )}
      </LocalizedClientLink>
      <Dropdown show={open}>
        <div className="shadow-lg lg:w-[460px]">
          <h3 className="heading-md border-b p-4 uppercase">{t('shopping_cart')}</h3>
          <div className="p-4">
            {Boolean(cartItemsCount) ? (
              <div>
                <div className="no-scrollbar max-h-[360px] overflow-y-scroll">
                  {validItems.map(item => (
                    <CartDropdownItem
                      key={`${item.product_id}-${item.variant_id}`}
                      item={item}
                      currency_code={cart?.currency_code || 'eur'}
                    />
                  ))}
                </div>
                <div className="pt-4">
                  <div className="flex items-center justify-between text-secondary">
                    {t('items')} <p className="label-md text-primary">{items}</p>
                  </div>
                  <div className="flex items-center justify-between text-secondary">
                    {t('delivery')} <p className="label-md text-primary">{delivery}</p>
                  </div>
                  <div className="flex items-center justify-between text-secondary">
                    {t('tax')} <p className="label-md text-primary">{tax}</p>
                  </div>
                  <div className="flex items-center justify-between text-secondary">
                    {t('total')} <p className="label-xl text-primary">{total}</p>
                  </div>
                  <LocalizedClientLink href="/cart">
                    <Button className="mt-4 w-full py-3">{t('go_to_cart')}</Button>
                  </LocalizedClientLink>
                </div>
              </div>
            ) : (
              <div className="px-8">
                <h4 className="heading-md text-center uppercase">{t('empty_heading')}</h4>
                <p className="py-4 text-center text-lg">{t('empty_inspiration')}</p>
                <LocalizedClientLink href="/categories">
                  <Button className="w-full py-3">{t('explore_home')}</Button>
                </LocalizedClientLink>
              </div>
            )}
          </div>
        </div>
      </Dropdown>
    </div>
  );
};
