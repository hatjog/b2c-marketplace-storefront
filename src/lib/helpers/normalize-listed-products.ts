import type { HttpTypes } from '@medusajs/types';
import * as Sentry from '@sentry/nextjs';

import type { SellerProps } from '@/types/seller';
import type { MultiVendorPricingFields } from '@/types/product';
import { resolveMarketAssetUrl } from '@/lib/helpers/asset-reference';
import { getMarketId } from '@/lib/helpers/market-filter';
import { getGpField, readContentBarFlag } from '@/lib/helpers/metadata-utils';

/**
 * Story cleanup-12c — ListedProduct widened with MultiVendorPricingFields so
 * that `vendor_offers`, `vendor_count`, and `lowest_price_pln` returned by
 * the backend middleware (cleanup-12a) flow through the normalizer without
 * being stripped by spread operations. AC1.
 */
export type ListedProduct = HttpTypes.StoreProduct & { seller?: SellerProps | null } & MultiVendorPricingFields;

/**
 * ŚCIEŻKA LEGACY EE-1 — TYMCZASOWA.
 *
 * Story 1.4 (AD-4) przeniosła decyzję gate'u na `metadata.gp.content_bar`
 * liczony w sync-time. Ten literał jest ZACHOWANYM zastanym progiem, używanym
 * WYŁĄCZNIE wtedy, gdy encja nie ma jeszcze `content_bar` — bo deploy kodu
 * i re-sync katalogu to dwa osobne zdarzenia (EE-1), a gate bez fallbacku
 * między nimi wyzerowałby katalog we WSZYSTKICH locale, łącznie z `/pl`.
 *
 * WARUNEK USUNIĘCIA: po potwierdzonym backfillu 113/113 i braku encji bez
 * `content_bar` w raporcie 4.3 — w osobnym oknie, nie w tej story.
 *
 * To NIE jest drugi próg: progi kanoniczne (80 / 40) żyją w JEDNYM module
 * `GP/backend/packages/api/src/scripts/lib/content-bar.ts` i nie wolno ich
 * importować ani przepisywać w storefroncie (AD-4). Ta stała jest eksportowana
 * także dla testu parity ze `scripts/smoke-pdp-locales.mjs` (Story 1.3, 1-3-F6).
 */
export const MIN_DESCRIPTION_WORDS = 80;

/**
 * Obserwowalność ścieżki legacy (AC5): agregowany sygnał per batch, dławiony
 * w czasie — „okno migracji" ma być widoczne, ale nie może zamienić się
 * w per-produkt spam na każdym renderze listingu.
 */
const LEGACY_GATE_SIGNAL_INTERVAL_MS = 10 * 60 * 1000;
let legacyGateSignalLastSentAt = 0;

function reportLegacyGateFallback(legacyCount: number, batchSize: number, gateSlug: string): void {
  if (legacyCount === 0) {
    return;
  }

  const now = Date.now();
  if (now - legacyGateSignalLastSentAt < LEGACY_GATE_SIGNAL_INTERVAL_MS) {
    return;
  }
  legacyGateSignalLastSentAt = now;

  Sentry.captureMessage(
    `Quality gate legacy fallback (EE-1): ${legacyCount}/${batchSize} products in this batch have no usable ` +
      `metadata.gp.content_bar['${gateSlug}'] — gate fell back to wordcount >= ${MIN_DESCRIPTION_WORDS}. ` +
      'Expected only inside the deploy→re-sync migration window; a persistent signal means the catalog backfill is missing.',
    {
      level: 'warning',
      tags: { gate_slug: gateSlug },
      extra: { legacy_products: legacyCount, batch_size: batchSize }
    }
  );
}

/** Test-only escape hatch dla dławika sygnału legacy. */
export function resetLegacyGateSignalThrottleForTests(): void {
  legacyGateSignalLastSentAt = 0;
}

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

type QualityGateResult = { failures: QualityGateFailure[]; usedLegacyDescriptionPath: boolean };

/**
 * AD-4: kryterium `description` czyta WYŁĄCZNIE `metadata.gp.content_bar[slug].bar`
 * i nie zlicza słów pobranego opisu. Liczenie w storefroncie uniemożliwiłoby
 * FAZĘ 1 — fetch dla `/de` dostaje przetłumaczony (stubowy) overlay, więc
 * „113 produktów × < 80 słów" wyzerowałoby katalog dokładnie tam, gdzie ma
 * działać fallback PL.
 *
 * Pozostałe kryteria (`price`, `image`) są nietknięte.
 */
function checkQualityGate(product: ListedProduct, gateSlug: string): QualityGateResult {
  const failures: QualityGateFailure[] = [];

  const bar = readContentBarFlag(product.metadata as Record<string, unknown>, gateSlug);
  const usedLegacyDescriptionPath = bar === undefined;

  if (usedLegacyDescriptionPath) {
    // EE-1: encja jeszcze nie przeszła przez sync z materializacją — zachowanie
    // IDENTYCZNE z dzisiejszym, żeby okno migracji nie wyzerowało katalogu.
    const wordCount = (product.description ?? '').split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_DESCRIPTION_WORDS) {
      failures.push({
        criterion: 'description',
        detail: `legacy (no content_bar['${gateSlug}']): words=${wordCount} < ${MIN_DESCRIPTION_WORDS}`
      });
    }
  } else if (!bar) {
    failures.push({ criterion: 'description', detail: `content_bar['${gateSlug}'].bar = false` });
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

  return { failures, usedLegacyDescriptionPath };
}

export type NormalizeListedProductsOptions = {
  /**
   * Slug mapy `content_bar`, wg którego oceniane jest kryterium `description`.
   * Rozstrzygany w warstwie danych przez `resolveContentBarGateSlug` z
   * `@/lib/content-gate` (FAZA 1 ⇒ `pl`; FAZA 2 dla locale ⇒ ten locale).
   * Pominięcie = FAZA 1 — bezpieczny default dla torów bez kontekstu locale.
   */
  gateSlug?: string;
};

export const normalizeListedProducts = (
  productsRaw: ListedProduct[],
  preferredSellerId?: string,
  options?: NormalizeListedProductsOptions
): ListedProduct[] => {
  const marketId = getMarketId();
  // Default 'pl' celowo lokalny: helper nie może importować `content-gate.ts`
  // (server-only + odczyt fs) — decyzja o fazie należy do warstwy danych.
  const gateSlug = options?.gateSlug ?? 'pl';
  let legacyPathCount = 0;
  let gatedBatchSize = 0;

  const normalized = productsRaw
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
      gatedBatchSize += 1;
      const { failures, usedLegacyDescriptionPath } = checkQualityGate(product, gateSlug);
      if (usedLegacyDescriptionPath) {
        legacyPathCount += 1;
      }
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

  reportLegacyGateFallback(legacyPathCount, gatedBatchSize, gateSlug);

  return normalized;
};