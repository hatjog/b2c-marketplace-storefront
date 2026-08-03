import type { HttpTypes } from '@medusajs/types';

import { ProductCard } from '@/components/organisms';

interface Props {
  products: HttpTypes.StoreProduct[];
  /**
   * Story v160-4-6: optional salon-anchored context — when set, each
   * ProductCard rendered here augments product hrefs with
   * `?from=seller:{handle}` so PDP can render the SalonContextChip overlay.
   */
  fromContext?: { type: 'seller'; handle: string };
}

const ProductListingProductsView = ({ products, fromContext }: Props) => (
  <div className="w-full">
    <ul className="flex flex-wrap gap-4">
      {products.map(product => (
        <li
          key={product.id}
          className="w-full min-w-[250px] lg:w-[calc(25%-1rem)]"
          data-testid="product-item"
        >
          <ProductCard
            product={product}
            fromContext={fromContext}
            className="h-full w-full min-w-0 lg:w-full"
          />
        </li>
      ))}
    </ul>
  </div>
);

export default ProductListingProductsView;
