import type { HttpTypes } from '@medusajs/types';

import { CartItemsFooter, CartItemsHeader, CartItemsProducts } from '@/components/cells';
import { hasMultipleSellers } from '@/lib/helpers/cart-vendor-context';
import { getCurrentFlagValue } from '@/lib/security/flagAtomicCheck';

import { CartGroupedBySeller } from '../CartGroupedBySeller/CartGroupedBySeller';
import { EmptyCart } from './EmptyCart';

/**
 * Story 5.7 — multi-vendor cart grouping flag (re-uses Story 5.5 pattern).
 * When ON AND any line item carries seller metadata → swap to
 * `<CartGroupedBySeller>` (sections per seller, alphabetical order).
 * When OFF or no seller metadata → legacy flat grouping by `product.seller`
 * preserved → zero regression vs v1.5.0 baseline.
 *
 * TF-75 (cleanup-32 synthesis): flag read via single helper
 * `getCurrentFlagValue()` from `@/lib/security/flagAtomicCheck`, invoked
 * INSIDE component body (not at module scope) to preserve cleanup-12f/13c
 * Turbopack TDZ-safe pattern.
 */

// `deliveryLabel` is required and has NO literal default: a default parameter
// reaches the DOM exactly like a written attribute, so a literal here is
// untranslated copy that no JSX-level guard can see. Making it required means a
// future caller cannot silently reintroduce the English fallback.
export const CartItems = ({
  cart,
  deliveryLabel
}: {
  cart: HttpTypes.StoreCart | null;
  deliveryLabel: string;
}) => {
  if (!cart) return null;

  const items = cart.items ?? [];
  if (items.length === 0) return <EmptyCart />;

  // cleanup-12f + TF-75: render-time flag read via single helper.
  const MULTI_VENDOR_PRICING_ENABLED = getCurrentFlagValue();

  // Story 5.7 — flag-gated grouping by selected seller metadata.
  if (MULTI_VENDOR_PRICING_ENABLED && hasMultipleSellers(items)) {
    return (
      <>
        <CartGroupedBySeller cart={cart} />
        <CartItemsFooter
          currency_code={cart.currency_code}
          price={cart.shipping_subtotal}
          label={deliveryLabel}
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
        label={deliveryLabel}
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
    // noqa: mercur15-drift — backward-compat shim: Story v160-cleanup-11 (8.8 follow-up): accept
    // Mercur 2 (`status === 'open'`) OR legacy Mercur 1.x (`store_status === 'ACTIVE'`) — see
    // normalize-listed-products.ts. Remove store_status branch once all API responses use seller.status.
    const activeSeller = sellerValue.find(
      seller => seller?.status === 'open' || seller?.store_status === 'ACTIVE' // noqa: mercur15-drift
    );
    return activeSeller ?? sellerValue[0] ?? null;
  }

  return sellerValue ?? null;
}
