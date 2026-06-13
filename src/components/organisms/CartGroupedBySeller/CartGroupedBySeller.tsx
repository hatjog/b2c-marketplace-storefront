'use client';

/**
 * CartGroupedBySeller — Story 5.7 multi-vendor cart grouping organism.
 *
 * Renders cart line items partitioned per seller (read from
 * `metadata.selected_seller_id` via Story 5.5 `readSelectedSeller`). Each
 * seller group exposes header (seller name + optional storefront link) and
 * its slice of line items via existing `CartItemsProducts` cell. Items
 * lacking seller context fall through to the "default" group rendered last.
 *
 * Server Component (default Next 15 RSC) — uses `getTranslations` async
 * helper. No client state required; render is pure prop-driven.
 *
 * Flag-gated by parent CartItems wire-up: callers should only render
 * <CartGroupedBySeller /> when both `MULTI_VENDOR_PRICING_ENABLED === 'true'`
 * and `hasMultipleSellers(items) === true`. Mini-cart (CartDropdown) keeps
 * flat layout per UX density rationale (drawer real estate).
 *
 * Story: v160-5-7-multi-vendor-cart-grouping (epic-5)
 */
import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { CartItemsProducts } from '@/components/cells';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { listOrderSetSplits } from '@/lib/data/order-sets';
import { groupLineItemsBySeller } from '@/lib/helpers/cart-vendor-context';
import { convertToLocale } from '@/lib/helpers/money';

interface CartGroupedBySellerProps {
  cart: HttpTypes.StoreCart;
  /** Show delete buttons per line item (cart page = true; review = false). */
  delete_item?: boolean;
  /** Show quantity edit per line item (cart page = true; review = false). */
  change_quantity?: boolean;
  /** Show subtotal per seller group footer (default true on review surfaces). */
  /** cleanup-12d AC3: defaults to true so cart page always shows per-vendor totals. */
  show_subtotal?: boolean;
}

export const CartGroupedBySeller = ({
  cart,
  delete_item = true,
  change_quantity = true,
  show_subtotal = true
}: CartGroupedBySellerProps) => {
  const t = useTranslations('seller.cart');
  const [splitSubtotals, setSplitSubtotals] = useState<Map<string, number>>(new Map());

  const items = cart.items ?? [];
  const groups = groupLineItemsBySeller(items);

  useEffect(() => {
    let cancelled = false;

    if (!cart.id) {
      setSplitSubtotals(new Map());
      return () => {
        cancelled = true;
      };
    }

    void listOrderSetSplits(cart.id).then(splits => {
      if (!cancelled) {
        setSplitSubtotals(new Map(splits.map(split => [split.seller_id, split.subtotal])));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cart.id]);

  if (groups.length === 0) {
    // Caller (CartItems organism) should already have early-returned EmptyCart;
    // defensive null render avoids stray section wrappers.
    return null;
  }

  return (
    <>
      {groups.map(group => {
        const groupKey = group.seller_id ?? 'default';
        const headerLabel = group.seller
          ? t('group_header_label', { seller_name: group.seller.name })
          : t('default_seller_group_label');
        const subtotalMinor =
          group.seller_id && splitSubtotals.has(group.seller_id)
            ? (splitSubtotals.get(group.seller_id) ?? group.subtotal)
            : group.subtotal;
        const subtotalFormatted = show_subtotal
          ? convertToLocale({
              amount: subtotalMinor,
              currency_code: cart.currency_code
            })
          : null;

        return (
          <section
            key={groupKey}
            data-testid="vendor-cart-group"
            data-seller-id={groupKey}
            className="mb-4 overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)]"
          >
            <header
              data-testid="vendor-group-header"
              className="flex items-center justify-between gap-4 border-b border-[var(--bb-border-soft)] bg-[var(--bb-white-75)] p-4"
            >
              <h2 className="heading-xs uppercase">{headerLabel}</h2>
              {group.seller?.handle && (
                <LocalizedClientLink
                  href={`/sellers/${group.seller.handle}`}
                  className="label-md text-secondary hover:underline"
                  data-testid={`cart-group-seller-link-${groupKey}`}
                >
                  {t('visit_seller_storefront')}
                </LocalizedClientLink>
              )}
            </header>
            <div className="p-2">
              <CartItemsProducts
                products={group.items}
                currency_code={cart.currency_code}
                delete_item={delete_item}
                change_quantity={change_quantity}
              />
            </div>
            {subtotalFormatted && (
              <footer
                className="border-t border-[var(--bb-border-soft)] bg-[var(--bb-white-75)] p-4 text-right"
                data-testid="vendor-group-total"
              >
                <p className="label-md text-secondary">
                  {t('subtotal_per_seller', { amount: subtotalFormatted })}
                </p>
              </footer>
            )}
          </section>
        );
      })}
    </>
  );
};
