import type { HttpTypes } from '@medusajs/types';

import { CartItemsHeader, CartItemsProducts } from '@/components/cells';
import { CartGroupedBySeller } from '@/components/organisms/CartGroupedBySeller/CartGroupedBySeller';
import { hasMultipleSellers } from '@/lib/helpers/cart-vendor-context';

/**
 * Story 5.7 — multi-vendor cart grouping flag (re-uses Story 5.5 pattern).
 * Checkout review surface mirrors cart page: flag ON + seller metadata →
 * grouped sections; else legacy flat grouping by `product.seller`. Review
 * surface passes `delete_item={false}` + `change_quantity={false}` per
 * existing baseline (cart is finalized at review step).
 */
const MULTI_VENDOR_PRICING_ENABLED =
  process.env.NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED === 'true';

export const CartItems = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  if (!cart) return null;

  const items = cart.items ?? [];

  // Story 5.7 — flag-gated grouping by selected seller metadata.
  if (MULTI_VENDOR_PRICING_ENABLED && hasMultipleSellers(items)) {
    return (
      <CartGroupedBySeller
        cart={cart}
        delete_item={false}
        change_quantity={false}
        show_subtotal
      />
    );
  }

  const groupedItems: any = groupItemsBySeller(cart);

  return Object.keys(groupedItems).map(key => (
    <div
      key={key}
      className="mb-4"
    >
      <CartItemsHeader seller={groupedItems[key]?.seller} />
      <CartItemsProducts
        delete_item={false}
        change_quantity={false}
        products={groupedItems[key].items || []}
        currency_code={cart.currency_code}
      />
    </div>
  ));
};

function groupItemsBySeller(cart: HttpTypes.StoreCart) {
  const groupedBySeller: any = {};

  cart.items?.forEach((item: any) => {
    const seller = item.product?.seller;
    if (seller) {
      if (!groupedBySeller[seller.id]) {
        groupedBySeller[seller.id] = {
          seller: seller,
          items: []
        };
      }
      groupedBySeller[seller.id].items.push(item);
    } else {
      if (!groupedBySeller['unknown']) {
        groupedBySeller['unknown'] = {
          seller: {
            name: 'Seller',
            id: 'unknown',
            photo: null,
            created_at: new Date()
          },
          items: []
        };
      }
      groupedBySeller['unknown'].items.push(item);
    }
  });

  return groupedBySeller;
}
