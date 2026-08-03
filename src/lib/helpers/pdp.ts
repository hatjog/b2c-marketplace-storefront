import type { HttpTypes } from '@medusajs/types';

import type { GpProductMetadata } from '@/types/product';
import type { SellerProps } from '@/types/seller';

type MaybeSeller = Partial<SellerProps> & {
  established_year?: number | null;
  treatments_count?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  reviewCount?: number | null;
  sold?: number | null;
  joinDate?: string | null;
};

export type PdpVoucherRules = {
  validityMonths: number;
  usageConditions: string[];
  refundPolicy: string;
  cancellationPolicy: string;
  extensionPolicy: string;
  noShowPolicy: string;
};

export type SellerProofInput = {
  years?: number | null;
  treatments?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  /** Set to `true` when a response-time proof point (e.g. "~4h") is provided. */
  hasResponseTime?: boolean;
};

export type ProductCatalogDisplayFields = {
  subtitle: string | null;
  durationMinutes: number | null;
  regulatoryClass: string | null;
  entitlementProfileId: string | null;
};

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function deriveSellerYears(
  seller?: MaybeSeller | null,
  now = new Date()
): number | undefined {
  const establishedYear = positiveNumber(seller?.established_year);
  if (establishedYear !== undefined) {
    return Math.max(0, now.getFullYear() - establishedYear);
  }

  const joinedAt = seller?.joinDate ?? seller?.created_at;
  if (!joinedAt) return undefined;

  const joined = new Date(joinedAt);
  if (Number.isNaN(joined.getTime())) return undefined;

  return Math.max(0, now.getFullYear() - joined.getFullYear());
}

export function deriveSellerTreatments(seller?: MaybeSeller | null): number | undefined {
  return positiveNumber(seller?.treatments_count) ?? positiveNumber(seller?.sold);
}

export function deriveSellerRatingCount(seller?: MaybeSeller | null): number | null {
  const explicit = positiveNumber(seller?.rating_count) ?? positiveNumber(seller?.reviewCount);

  if (explicit !== undefined) {
    return explicit;
  }

  if (Array.isArray(seller?.reviews)) {
    return seller.reviews.filter(Boolean).length;
  }

  return null;
}

export function countSellerProofPoints(input: SellerProofInput): number {
  return [
    input.years !== null && input.years !== undefined,
    input.treatments !== null && input.treatments !== undefined,
    input.rating !== null &&
      input.rating !== undefined &&
      input.ratingCount !== null &&
      input.ratingCount !== undefined,
    input.hasResponseTime === true
  ].filter(Boolean).length;
}

export function formatSellerDistrictAddress(seller?: MaybeSeller | null): string | null {
  if (!seller?.name) return null;

  const district =
    typeof seller.district === 'string' && seller.district.trim()
      ? seller.district.trim()
      : Array.isArray(seller.locations)
        ? seller.locations.find(location => location?.district)?.district?.trim()
        : null;

  if (district) {
    return `${seller.name} · ${district}`;
  }

  const city = typeof seller.city === 'string' && seller.city.trim() ? seller.city.trim() : null;
  return city ? `${seller.name} · ${city}` : seller.name;
}

function parseValidityMonths(raw: unknown): number | undefined {
  const numeric = positiveNumber(raw);
  if (numeric !== undefined) return Math.max(1, Math.round(numeric));

  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  const match = normalized.match(/(\d+)/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  if (normalized.includes('day') || normalized.includes('dni') || normalized.includes('d')) {
    return Math.max(1, Math.round(amount / 30));
  }

  return Math.max(1, Math.round(amount));
}

export function resolvePdpVoucherRules(
  metadata: GpProductMetadata | null | undefined,
  fallbackCopy: {
    usageConditions: string[];
    refundPolicy: string;
    cancellationPolicy: string;
    extensionPolicy: string;
    noShowPolicy: string;
  }
): PdpVoucherRules {
  const rawValidity =
    metadata?.validity_months ??
    metadata?.validityMonths ??
    metadata?.validity_period ??
    metadata?.validityPeriod;

  const usageConditions = Array.isArray(metadata?.realization_rules)
    ? metadata.realization_rules.filter(
        (rule): rule is string => typeof rule === 'string' && rule.trim().length > 0
      )
    : fallbackCopy.usageConditions;

  return {
    validityMonths: parseValidityMonths(rawValidity) ?? 12,
    usageConditions,
    refundPolicy:
      typeof metadata?.refund_policy === 'string' && metadata.refund_policy.trim()
        ? metadata.refund_policy
        : fallbackCopy.refundPolicy,
    cancellationPolicy:
      typeof metadata?.cancellation_policy === 'string' && metadata.cancellation_policy.trim()
        ? metadata.cancellation_policy
        : fallbackCopy.cancellationPolicy,
    extensionPolicy:
      typeof metadata?.extension_policy === 'string' && metadata.extension_policy.trim()
        ? metadata.extension_policy
        : fallbackCopy.extensionPolicy,
    noShowPolicy:
      typeof metadata?.no_show_policy === 'string' && metadata.no_show_policy.trim()
        ? metadata.no_show_policy
        : fallbackCopy.noShowPolicy
  };
}

export function resolveProductCatalogDisplayFields(
  product:
    | (HttpTypes.StoreProduct & {
        subtitle?: string | null;
      })
    | null
    | undefined,
  metadata: GpProductMetadata | null | undefined
): ProductCatalogDisplayFields {
  const nativeSubtitle =
    typeof product?.subtitle === 'string' && product.subtitle.trim().length > 0
      ? product.subtitle.trim()
      : null;
  const metadataSubtitle =
    typeof metadata?.subtitle === 'string' && metadata.subtitle.trim().length > 0
      ? metadata.subtitle.trim()
      : null;
  const durationMinutes =
    typeof metadata?.duration_minutes === 'number' && Number.isFinite(metadata.duration_minutes)
      ? metadata.duration_minutes
      : null;
  const regulatoryClass =
    typeof metadata?.regulatory_class === 'string' && metadata.regulatory_class.trim().length > 0
      ? metadata.regulatory_class.trim()
      : null;
  const entitlementProfileId =
    typeof metadata?.entitlement_profile_id === 'string' &&
    metadata.entitlement_profile_id.trim().length > 0
      ? metadata.entitlement_profile_id.trim()
      : typeof metadata?.entitlement_profile?.profile_id === 'string' &&
          metadata.entitlement_profile.profile_id.trim().length > 0
        ? metadata.entitlement_profile.profile_id.trim()
        : null;

  return {
    subtitle: nativeSubtitle ?? metadataSubtitle,
    durationMinutes,
    regulatoryClass,
    entitlementProfileId
  };
}

export function normalizePdpGalleryImages(product: HttpTypes.StoreProduct) {
  if (product.images?.length) {
    return product.images;
  }

  if (product.thumbnail) {
    return [{ id: `${product.id}-thumbnail`, url: product.thumbnail, rank: 0 }];
  }

  return [
    {
      id: `${product.id}-placeholder`,
      url: '/images/product/placeholder.jpg',
      rank: 0
    }
  ];
}
