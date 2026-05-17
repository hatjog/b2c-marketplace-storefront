'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/atoms';
import { MiniCartDrawer, type CartItem as MiniCartItem } from '@/components/organisms';
import { useCartContext } from '@/components/providers';
import { usePrevious } from '@/hooks/usePrevious';
import { CartIcon } from '@/icons';
import { applyPromotions } from '@/lib/data/cart';
import { filterValidCartItems } from '@/lib/helpers/filter-valid-cart-items';
import { toast } from '@/lib/helpers/toast';

const getItemCount = (cart: HttpTypes.StoreCart | null) => {
  return cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
};

function toMajor(amount: number | null | undefined): number {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return 0;
  }
  return amount / 100;
}

function mapMiniCartItems(cart: HttpTypes.StoreCart | null, fallbackName: string): MiniCartItem[] {
  const validItems = filterValidCartItems(cart?.items);
  return validItems.map(item => ({
    id: item.id,
    name: item.product_title || item.title || fallbackName,
    imageUrl: item.thumbnail || undefined,
    quantity: item.quantity,
    unitPrice: toMajor(
      item.unit_price ??
        (item.quantity > 0 && item.subtotal != null ? item.subtotal / item.quantity : 0)
    )
  }));
}

export const CartDropdown = () => {
  const { cart, removeCartItem, refreshCart } = useCartContext();
  const [open, setOpen] = useState(false);
  const t = useTranslations('cart');
  const tMiniCart = useTranslations('mini_cart');
  const locale = useLocale();
  const router = useRouter();
  const previousItemCount = usePrevious(getItemCount(cart));
  const cartItemsCount = getItemCount(cart);
  const pathname = usePathname();

  useEffect(() => {
    if (
      previousItemCount !== undefined &&
      cartItemsCount > previousItemCount &&
      !pathname.includes('/cart')
    ) {
      setOpen(true);
    }
  }, [cartItemsCount, previousItemCount, pathname]);

  const hasMiniCartDrawer = typeof MiniCartDrawer === 'function';

  const onApplyDiscount = async (code: string) => {
    const result = await applyPromotions([code]);
    if (!result.success) {
      toast.info({ title: result.error || t('promo_not_found') });
      return;
    }
    if (!result.applied) {
      toast.info({ title: t('promo_not_found') });
      return;
    }
    toast.success({ title: t('promo_applied') });
    await refreshCart();
  };

  const cartWithPromotions = cart as (HttpTypes.StoreCart & {
    promotions?: Array<{ code?: string }>;
  }) | null;
  const discountCode = cartWithPromotions?.promotions?.[0]?.code;
  const discountAmount = toMajor(Math.max(0, Math.abs(cart?.discount_subtotal ?? 0)));
  const discountApplied =
    discountCode && discountAmount > 0
      ? {
          code: discountCode,
          amount: discountAmount
        }
      : null;

  if (!hasMiniCartDrawer) {
    return (
      <button
        type="button"
        className="relative"
        aria-label={t('go_to_cart_aria')}
        onClick={() => router.push(`/${locale}/cart`)}
      >
        <CartIcon size={20} />
        {Boolean(cartItemsCount) && (
          <Badge className="absolute -right-2 -top-2 h-4 w-4 p-0">{cartItemsCount}</Badge>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative"
        aria-label={t('open_cart_drawer_aria')}
        onClick={() => setOpen(true)}
        data-testid="cart-icon-open-drawer"
      >
        <CartIcon size={20} />
        {Boolean(cartItemsCount) && (
          <Badge className="absolute -right-2 -top-2 h-4 w-4 p-0">{cartItemsCount}</Badge>
        )}
      </button>
      <MiniCartDrawer
        open={open}
        onClose={() => setOpen(false)}
        items={mapMiniCartItems(cart, t('item_fallback_name'))}
        subtotal={toMajor(cart?.item_subtotal ?? 0)}
        discountApplied={discountApplied}
        currency={(cart?.currency_code || 'eur').toUpperCase()}
        locale={locale}
        onCheckout={() => {
          setOpen(false);
          router.push(`/${locale}/checkout?step=address`);
        }}
        onRemoveItem={async (itemId) => {
          await removeCartItem(itemId);
          await refreshCart();
        }}
        onApplyDiscount={onApplyDiscount}
      />
      <span
        className="sr-only"
        aria-live="polite"
      >
        {tMiniCart('title')}
      </span>
    </div>
  );
};
