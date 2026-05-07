import type { HttpTypes } from '@medusajs/types';
import * as Sentry from '@sentry/nextjs';

import type { SellerProps } from '@/types/seller';
import type { MultiVendorPricingFields } from '@/types/product';
import { resolveMarketAssetUrl } from '@/lib/helpers/asset-reference';
import { getMarketId } from '@/lib/helpers/market-filter';
import { getGpField } from '@/lib/helpers/metadata-utils';

/**
 * Story cleanup-12c — ListedProduct widened with MultiVendorPricingFields so
 * that `vendor_offers`, `vendor_count`, and `lowest_price_pln` returned by
 * the backend middleware (cleanup-12a) flow through the normalizer without
 * being stripped by spread operations. AC1.
 */
export type ListedProduct = HttpTypes.StoreProduct & { seller?: SellerProps | null } & MultiVendorPricingFields;

const MIN_DESCRIPTION_WORDS = 80;

const PLACEHOLDER_PATTERNS = [
  /placeholder/i,
  /no-image/i,
  /default-product/i,
  /via\.placeholder\.com/i,
  /cdn\.example\.com/i,
];

type QualityGateFailure = { criterion: string; detail: string };

function isSellerActive(seller: SellerProps | null | undefined): boolean {
  if (!seller) {
    return false;
  }

  // noqa: mercur15-drift — backward-compat dual-check: Mercur 2 `seller.status === 'open'` OR
  // legacy Mercur 1.x `store_status === 'ACTIVE'` shim. Remove store_status branch once all
  // API responses carry seller.status (Mercur 2 native field).
  return seller.status === 'open' || seller.store_status === 'ACTIVE'; // noqa: mercur15-drift
}

function normalizeProductAssetReferences(product: ListedProduct, marketId: string): ListedProduct {
  const thumbnail = resolveMarketAssetUrl(product.thumbnail, marketId) ?? product.thumbnail ?? null;
  const images = Array.isArray(product.images)
    ? product.images.flatMap(image => {
        const url = resolveMarketAssetUrl(image?.url, marketId);
        return url ? [{ ...image, url }] : [];
      })
    : product.images;

  return {
    ...product,
    thumbnail,
    images,
  };
}

function resolveSingleSeller(product: ListedProduct, preferredSellerId?: string): SellerProps | null {
  const sellerValue = (product as ListedProduct & { seller?: SellerProps | SellerProps[] | null }).seller;

  if (Array.isArray(sellerValue)) {
    if (preferredSellerId) {
      const preferredSeller = sellerValue.find((seller) => seller?.id === preferredSellerId);
      if (preferredSeller) {
        return preferredSeller as SellerProps;
      }
    }

    const activeSeller = sellerValue.find((seller) => isSellerActive(seller as SellerProps | null | undefined));
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
  const marketId = getMarketId();

  return productsRaw
    .map((product) => {
      const normalizedProduct = normalizeProductAssetReferences(product, marketId);
      const seller = resolveSingleSeller(normalizedProduct, preferredSellerId);
      return {
        ...normalizedProduct,
        seller,
      };
    })
    .filter(product => {
      if (!product.seller) return true;
      return isSellerActive(product.seller);
    })
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