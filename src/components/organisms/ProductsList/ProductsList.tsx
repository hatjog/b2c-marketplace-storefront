import type { HttpTypes } from '@medusajs/types';

import { ProductCard } from '../ProductCard/ProductCard';

export const ProductsList = ({
  products,
  fromContext,
}: {
  products: HttpTypes.StoreProduct[];
  /**
   * Story v160-4-6: optional salon-anchored context — when set, ProductCard
   * augments product hrefs with `?from=seller:{handle}` so PDP renders the
   * SalonContextChip overlay. Pass-through prop only; no logic here.
   */
  fromContext?: { type: 'seller'; handle: string };
}) => {
  return (
    <>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          fromContext={fromContext}
        />
      ))}
    </>
  );
};
