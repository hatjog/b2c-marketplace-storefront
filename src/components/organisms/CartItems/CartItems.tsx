import type { HttpTypes } from '@medusajs/types';

import { CartItemsFooter, CartItemsHeader, CartItemsProducts } from '@/components/cells';

import { EmptyCart } from './EmptyCart';

export const CartItems = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  if (!cart) return null;

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
