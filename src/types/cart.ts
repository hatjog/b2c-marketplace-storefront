import type { HttpTypes } from '@medusajs/types';

export interface Cart extends HttpTypes.StoreCart {
  discount_subtotal?: number;
}

export interface StoreCartLineItemOptimisticUpdate extends Partial<HttpTypes.StoreCartLineItem> {
  /**
   * Wymagane mimo `Partial<>`: każda pozycja w `cart.items` musi mieć stabilną
   * tożsamość, bo listy koszyka (MiniCartDrawer, CartItemsProducts) kluczują po
   * `id`. Dla pozycji optymistycznej użyj `buildOptimisticLineItemId`
   * (`@/lib/helpers/optimistic-line-item`) — nigdy nie omijaj tego pola
   * rzutowaniem `as`.
   */
  id: string;
  subtotal?: number;
  total?: number;
  tax_total: number;
}
