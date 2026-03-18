import type { HttpTypes } from '@medusajs/types';
import * as Sentry from '@sentry/nextjs';

import type { SellerProps } from '@/types/seller';

export type ListedProduct = HttpTypes.StoreProduct & { seller?: SellerProps | null };

const MIN_DESCRIPTION_WORDS = 80;

function passesQualityGate(product: ListedProduct): boolean {
  const wordCount = (product.description ?? '').split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_DESCRIPTION_WORDS) return false;

  const price = product.variants?.[0]?.calculated_price?.calculated_amount;
  if (!price || price <= 0) return false;

  if (!product.thumbnail) return false;

  return true;
}

export const normalizeListedProducts = (productsRaw: ListedProduct[]): ListedProduct[] => {
  return productsRaw
    .filter(product => product.seller?.store_status === 'ACTIVE' || !product.seller)
    .filter(product => {
      const passes = passesQualityGate(product);
      if (!passes && product.status === 'published') {
        Sentry.captureMessage(
          `Quality gate drift: product '${product.handle}' is published but fails storefront quality gate`,
          { level: 'warning', tags: { product_id: product.id, handle: product.handle ?? 'unknown' } }
        );
      }
      return passes;
    })
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