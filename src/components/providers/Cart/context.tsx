import { createContext, useContext } from 'react';

import type { Cart, StoreCartLineItemOptimisticUpdate } from '@/types/cart';

interface CartContextInterface {
  cart: Cart | null;
  onAddToCart: (item: StoreCartLineItemOptimisticUpdate, currency_code: string) => void;
  addToCart: (params: {
    variantId: string;
    quantity: number;
    countryCode: string;
    /** Story 5.5 — optional seller selection from multi-vendor PDP;
     *  persisted as cart_item metadata for downstream grouping (Story 5.7). */
    selectedSellerId?: string | null;
    /** Story 5.5 — denormalized seller name dla cart UI render. */
    selectedSellerName?: string | null;
  }) => Promise<void>;
  removeCartItem: (lineId: string) => Promise<void>;
  updateCartItem: (lineId: string, quantity: number) => Promise<void>;
  refreshCart: () => Promise<Cart | null>;
  isUpdating: boolean;
  isAddingItem: boolean;
  isUpdatingItem: boolean;
  isRemovingItem: boolean;
  /**
   * Story 5.5 — multi-vendor PDP seller selection state shared across
   * sibling client components (SellerSelector → ProductDetailsHeader).
   * `null` gdy SellerSelector not rendered (flag OFF lub vendor_offers < 2)
   * → addToCart legacy single-vendor flow.
   */
  selectedSellerId: string | null;
  selectedSellerName: string | null;
  setSelectedSeller: (ctx: { id: string; name: string } | null) => void;
}

export const CartContext = createContext<CartContextInterface | null>(null);

export function useCartContext() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
}
