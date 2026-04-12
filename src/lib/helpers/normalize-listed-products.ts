import type { HttpTypes } from '@medusajs/types';
import * as Sentry from '@sentry/nextjs';

import type { SellerProps } from '@/types/seller';
import { getGpField } from '@/lib/helpers/metadata-utils';

export type ListedProduct = HttpTypes.StoreProduct & { seller?: SellerProps | null };

const MIN_DESCRIPTION_WORDS = 80;

const PLACEHOLDER_PATTERNS = [
  /placeholder/i,
  /no-image/i,
  /default-product/i,
  /via\.placeholder\.com/i,
  /cdn\.example\.com/i,
];

type QualityGateFailure = { criterion: string; detail: string };

function resolveSingleSeller(product: ListedProduct, preferredSellerId?: string): SellerProps | null {
  const sellerValue = (product as ListedProduct & { seller?: SellerProps | SellerProps[] | null }).seller;

  if (Array.isArray(sellerValue)) {
    if (preferredSellerId) {
      const preferredSeller = sellerValue.find((seller) => seller?.id === preferredSellerId);
      if (preferredSeller) {
        return preferredSeller as SellerProps;
      }
    }

    const activeSeller = sellerValue.find((seller) => seller?.store_status === 'ACTIVE');
    return (activeSeller ?? sellerValue[0] ?? null) as SellerProps | null;
  }

  return (sellerValue ?? null) as SellerProps | null;
}

function checkQualityGate(product: ListedProduct): QualityGateFailure[] {
  const failures: QualityGateFailure[] = [];

  const wordCount = (product.description ?? '').split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_DESCRIPTION_WORDS) {
    failures.push({ criterion: 'description', detail: `words=${wordCount} < ${MIN_DESCRIPTION_WORDS}` });
  }

  const hasVendorPricing = getGpField<boolean>(product.metadata as Record<string, unknown>, 'has_vendor_pricing') === true;
  const hasValidPrice = hasVendorPricing || product.variants?.some(
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

export const normalizeListedProducts = (
  productsRaw: ListedProduct[],
  preferredSellerId?: string
): ListedProduct[] => {
  return productsRaw
    .map((product) => {
      const seller = resolveSingleSeller(product, preferredSellerId);
      return {
        ...product,
        seller,
      };
    })
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