'use client';

// @chrome-manifest: W6-08 (cell renders <MiniCartDrawer> per Story 0.14)

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
  // Portal montujemy dopiero po hydratacji — `document` nie istnieje w SSR.
  // Nie zmienia to markupu serwerowego, bo drawer i tak startuje zamkniety.
  const [portalReady, setPortalReady] = useState(false);
  const t = useTranslations('cart');
  const tMiniCart = useTranslations('mini_cart');
  const locale = useLocale();
  const router = useRouter();
  const previousItemCount = usePrevious(getItemCount(cart));
  const cartItemsCount = getItemCount(cart);
  const pathname = usePathname();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Zamknij przy zmianie trasy. `CartDropdown` mieszka w headerze i NIE
  // odmontowuje sie przy nawigacji, wiec bez tego otwarty drawer jechalby
  // z uzytkownikiem na kolejna strone i zakrywal ja razem z blokada scrolla.
  // Nie kolidowalo to z niczym, dopoki drawer byl niewidoczny na mobile.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (
      previousItemCount !== undefined &&
      cartItemsCount > previousItemCount &&
      !pathname.includes('/cart')
    ) {
      setOpen(true);
    }
  }, [cartItemsCount, previousItemCount, pathname]);

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
      {/* Drawer idzie do `document.body`, a NIE zostaje tutaj.
       *
       * `SiteHeader` trzyma ten komponent w kontenerze `hidden ... lg:flex`, wiec
       * ponizej breakpointu `lg` cale poddrzewo — razem z drawerem — bylo
       * `display: none`. Efekt: na telefonie dodanie do koszyka otwieralo drawer,
       * ktorego nie dalo sie zobaczyc ani zamknac, a jego focus trap blokowal
       * scroll calej strony (i nie puszczal, bo `CartDropdown` zyje w headerze
       * i nie odmontowuje sie przy nawigacji). Kontrakt W6-08 mowi wprost:
       * `breakpoint_behavior.mobile: full-screen overlay sliding from right`.
       *
       * Portal wyprowadza drawer spod KAZDEGO stylu przodka — nie tylko
       * `display: none`, ale takze `transform`/`filter` (lamia `position: fixed`)
       * i `overflow: hidden` oraz cudzych kontekstow stackowania. */}
      {portalReady &&
        createPortal(
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
          />,
          document.body
        )}
      <span
        className="sr-only"
        aria-live="polite"
      >
        {tMiniCart('title')}
      </span>
    </div>
  );
};
