/**
 * Tożsamość optymistycznej pozycji koszyka.
 *
 * `CartProvider.handleAddToCart` wstawia pozycję do `cart.items` zanim API zwróci
 * prawdziwy line item. Bez własnego `id` taka pozycja renderowała się jako
 * `<li key={undefined}>` w MiniCartDrawer i CartItemsProducts (ostrzeżenie React
 * o kluczach), a okno przed `refreshCart()` jest na mobile na tyle długie, że
 * użytkownik zdąży ją zobaczyć.
 *
 * Id musi być DETERMINISTYCZNE (bez Math.random / Date.now / randomUUID), żeby
 * tożsamość pozycji nie zmieniała się między renderami. Prefiks celowo nie
 * zawiera dwukropka ani innych znaków wymagających escapowania w selektorach
 * CSS — id trafia do `data-testid="mini-cart-item-<id>"`.
 */

export const OPTIMISTIC_LINE_ITEM_ID_PREFIX = 'optimistic-';

export function buildOptimisticLineItemId(variantId: string): string {
  // Pusty variantId zwróciłby samo `optimistic-` dla KAŻDEJ pozycji, czyli
  // duplikaty kluczy — dokładnie ta klasa defektu, którą ten moduł zamyka.
  // Wołający na PDP ma już guard `if (!variantId) return`; rzut chroni
  // przyszłe miejsca budowy.
  if (!variantId.trim()) {
    throw new Error('buildOptimisticLineItemId: variantId nie może być pusty');
  }
  return `${OPTIMISTIC_LINE_ITEM_ID_PREFIX}${variantId}`;
}
