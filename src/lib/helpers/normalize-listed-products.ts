import type { HttpTypes } from '@medusajs/types';

import type { SellerProps } from '@/types/seller';

export type ListedProduct = HttpTypes.StoreProduct & { seller?: SellerProps | null };

export const normalizeListedProducts = (productsRaw: ListedProduct[]): ListedProduct[] => {
  return productsRaw
    .filter(product => product.seller?.store_status !== 'SUSPENDED')
    .map(product => {
      if (!product.seller) {
        return product;
      }

      return {
        ...product,
        seller: {
          ...product.seller,
          reviews: product.seller.reviews?.filter(item => !!item) ?? []
        }
      };
    });
};