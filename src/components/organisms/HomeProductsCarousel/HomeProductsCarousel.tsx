import type { HttpTypes } from '@medusajs/types';

import { Carousel } from '@/components/cells';
import { listProducts } from '@/lib/data/products';
import type { Product } from '@/types/product';

import { ProductCard } from '../ProductCard/ProductCard';

export const HomeProductsCarousel = async ({
  locale,
  sellerProducts,
  home
}: {
  locale: string;
  sellerProducts: (Product | HttpTypes.StoreProduct)[];
  home: boolean;
}) => {
  const products = sellerProducts.length
    ? sellerProducts
    : (
        await listProducts({
          countryCode: locale,
          queryParams: {
            limit: home ? 4 : undefined,
            order: 'created_at',
            handle: home ? undefined : sellerProducts.map(product => product.handle)
          },
          forceCache: !home
        })
      ).response.products;

  if (!products.length && !sellerProducts.length) return null;

  return (
    <div className="flex w-full justify-center">
      <Carousel
        align="start"
        items={products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
          />
        ))}
      />
    </div>
  );
};
