import type { HttpTypes } from '@medusajs/types';

import type { SelfPurchaseMode } from '@/lib/helpers/parse-purchase-mode';

type CategoryPlpSemanticFilters = {
  salonHandle?: string;
  availability?: 'in_stock';
  purchaseMode?: SelfPurchaseMode;
};

type ProductWithSeller = HttpTypes.StoreProduct & {
  seller?: { handle?: string | null } | null;
  metadata?: {
    gp?: {
      purchase_mode?: unknown;
      availability?: unknown;
      in_stock?: unknown;
    } | null;
    purchase_mode?: unknown;
    availability?: unknown;
    in_stock?: unknown;
  } | null;
};

type ProductVariantWithInventory = {
  manage_inventory?: boolean | null;
  allow_backorder?: boolean | null;
  inventory_quantity?: number | null;
};

type ResolvedPurchaseMode = SelfPurchaseMode | 'both';

function resolveProductPurchaseMode(product: ProductWithSeller): ResolvedPurchaseMode {
  const gpMode = product.metadata?.gp?.purchase_mode;
  const rootMode = product.metadata?.purchase_mode;
  const rawMode = typeof gpMode === 'string' ? gpMode : typeof rootMode === 'string' ? rootMode : null;

  if (!rawMode) {
    // Contract for Category PLP: missing mode metadata means "both".
    return 'both';
  }

  const normalized = rawMode.trim().toLowerCase();

  if (normalized === 'gift' || normalized === 'self' || normalized === 'both') {
    return normalized;
  }

  // Unknown values are treated as "both" to avoid accidental exclusions.
  return 'both';
}

function readExplicitAvailability(product: ProductWithSeller): boolean | null {
  const candidates = [
    product.metadata?.gp?.in_stock,
    product.metadata?.in_stock,
    product.metadata?.gp?.availability,
    product.metadata?.availability,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return candidate;
    }

    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();

      if (['in_stock', 'available', 'true', '1'].includes(normalized)) {
        return true;
      }

      if (['out_of_stock', 'unavailable', 'false', '0'].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

function isProductAvailableNow(product: ProductWithSeller): boolean {
  const explicit = readExplicitAvailability(product);
  if (explicit != null) {
    return explicit;
  }

  const variants = (product.variants ?? []) as ProductVariantWithInventory[];
  if (variants.length === 0) {
    return true;
  }

  return variants.some((variant) => {
    if (variant.manage_inventory === false) return true;
    if (variant.allow_backorder === true) return true;
    if (typeof variant.inventory_quantity !== 'number') {
      // Defensive fail-open: missing inventory payload cannot hide products.
      return true;
    }
    return variant.inventory_quantity > 0;
  });
}

export function applyCategoryPlpSemanticFilters(
  products: HttpTypes.StoreProduct[],
  filters?: CategoryPlpSemanticFilters
): HttpTypes.StoreProduct[] {
  if (!filters) return products;

  return products.filter((rawProduct) => {
    const product = rawProduct as ProductWithSeller;

    if (filters.salonHandle && product.seller?.handle !== filters.salonHandle) {
      return false;
    }

    if (filters.availability === 'in_stock' && !isProductAvailableNow(product)) {
      return false;
    }

    if (filters.purchaseMode) {
      const productMode = resolveProductPurchaseMode(product);
      if (filters.purchaseMode === 'self' && productMode === 'gift') {
        return false;
      }
      if (filters.purchaseMode === 'gift' && productMode === 'self') {
        return false;
      }
    }

    return true;
  });
}
