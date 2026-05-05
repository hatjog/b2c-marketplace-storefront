import type { HttpTypes } from '@medusajs/types';

import { CartItemsFooter, CartItemsHeader, CartItemsProducts } from '@/components/cells';
import { hasMultipleSellers } from '@/lib/helpers/cart-vendor-context';
import { isMultiVendorEnabled } from '@/lib/flags/multiVendorPricing';

import { CartGroupedBySeller } from '../CartGroupedBySeller/CartGroupedBySeller';

import { EmptyCart } from './EmptyCart';

/**
 * Story 5.7 — multi-vendor cart grouping flag (re-uses Story 5.5 pattern).
 * When ON AND any line item carries seller metadata → swap to
 * `<CartGroupedBySeller>` (sections per seller, alphabetical order).
 * When OFF or no seller metadata → legacy flat grouping by `product.seller`
 * preserved → zero regression vs v1.5.0 baseline.
 *
 * cleanup-12f: flag check moved inside component body to avoid Turbopack
 * module-evaluation order issue with barrel imports (ReferenceError at SSR).
 */
export const CartItems = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  if (!cart) return null;

  const items = cart.items ?? [];
  if (items.length === 0) return <EmptyCart />;

  // Story 5.7 — flag-gated grouping by selected seller metadata.
  if (isMultiVendorEnabled() && hasMultipleSellers(items)) {
    return (
      <>
        <CartGroupedBySeller cart={cart} />
        <CartItemsFooter
          currency_code={cart.currency_code}
          price={cart.shipping_subtotal}
        />
      </>
    );
  }

  // Legacy flat grouping by product.seller (pre-5.7 baseline).
  const groupedItems: any = groupItemsBySeller(cart);

  if (!Object.keys(groupedItems).length) return <EmptyCart />;

  return Object.keys(groupedItems).map(key => (
    <div
      key={key}
      className="mb-4"
      data-testid={`cart-items-seller-${key}`}
    >
      <CartItemsHeader seller={groupedItems[key]?.seller} />
      <CartItemsProducts
        products={groupedItems[key].items || []}
        currency_code={cart.currency_code}
      />
      <CartItemsFooter
        currency_code={cart.currency_code}
        price={cart.shipping_subtotal}
      />
    </div>
  ));
};

function groupItemsBySeller(cart: HttpTypes.StoreCart) {
  const groupedBySeller: any = {};

  cart.items?.forEach((item: any) => {
    const seller = resolveCartItemSeller(item.product?.seller);
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

function resolveCartItemSeller(sellerValue: any) {
  if (Array.isArray(sellerValue)) {
    const activeSeller = sellerValue.find(
      (seller) => seller?.status === 'open' || seller?.store_status === 'ACTIVE'
    );
    return activeSeller ?? sellerValue[0] ?? null;
  }

  return sellerValue ?? null;
}
