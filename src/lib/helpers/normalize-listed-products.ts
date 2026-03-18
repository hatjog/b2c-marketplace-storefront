import type { HttpTypes } from '@medusajs/types';
import * as Sentry from '@sentry/nextjs';

import type { SellerProps } from '@/types/seller';

export type ListedProduct = HttpTypes.StoreProduct & { seller?: SellerProps | null };

const MIN_DESCRIPTION_WORDS = 80;

const PLACEHOLDER_PATTERNS = [
  /placeholder/i,
  /no-image/i,
  /default-product/i,
  /via\.placeholder\.com/i,
];

type QualityGateFailure = { criterion: string; detail: string };

function checkQualityGate(product: ListedProduct): QualityGateFailure[] {
  const failures: QualityGateFailure[] = [];

  const wordCount = (product.description ?? '').split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_DESCRIPTION_WORDS) {
    failures.push({ criterion: 'description', detail: `words=${wordCount} < ${MIN_DESCRIPTION_WORDS}` });
  }

  const hasValidPrice = product.variants?.some(
    (v) => (v.calculated_price?.calculated_amount ?? 0) > 0
  );
  if (!hasValidPrice) {
    failures.push({ criterion: 'price', detail: 'no variant with calculated_amount > 0' });
  }

  const thumbnail = product.thumbnail ?? '';
  if (!thumbnail) {
    failures.push({ criterion: 'image', detail: 'thumbnail missing' });
  } else if (PLACEHOLDER_PATTERNS.some((p) => p.test(thumbnail))) {
    failures.push({ criterion: 'image', detail: 'thumbnail is placeholder' });
  }

  return failures;
}

function passesQualityGate(product: ListedProduct): boolean {
  return checkQualityGate(product).length === 0;
}

export const normalizeListedProducts = (productsRaw: ListedProduct[]): ListedProduct[] => {
  return productsRaw
    .filter(product => product.seller?.store_status === 'ACTIVE' || !product.seller)
    .filter(product => {
      const failures = checkQualityGate(product);
      if (failures.length > 0 && product.status === 'published') {
        const failedCriteria = failures.map((f) => `${f.criterion}: ${f.detail}`).join('; ');
        Sentry.captureMessage(
          `Quality gate drift: product '${product.handle}' is published but fails storefront quality gate — ${failedCriteria}`,
          { level: 'warning', tags: { product_id: product.id, handle: product.handle ?? 'unknown' } }
        );
      }
      return failures.length === 0;
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