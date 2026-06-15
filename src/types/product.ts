import type { SellerProps } from './seller';

export type GpProductMetadata = {
  subtitle?: string | null;
  duration_minutes?: number | null;
  validity_period?: string | null;
  /** F18 fix: typed slot for product-level realization rules — overrides
   *  market-level `pdp_trust_signals` when present. v1.7.0 backend may not yet
   *  populate this field; storefront falls back to `pdp_trust_signals` when
   *  this is missing. Owned by Story 2.9 (legal/help SSOT) post-v1.7.0. */
  realization_rules?: string[] | null;
  seo?: { meta_title?: string; meta_description?: string; og_image_url?: string } | null;
  has_vendor_pricing?: boolean | null;
  sort_rank?: number | null;
  regulatory_class?: string | null;
  entitlement_profile_id?: string | null;
  entitlement_profile?: {
    profile_id: string;
    entitlement_type: string;
    policy: Record<string, unknown>;
    currency?: string;
  } | null;
  vendor_id?: string | null;
  [key: string]: unknown;
};

/**
 * Story 5.1 — multi-vendor lowest-price badge schema augmentation.
 *
 * v1.6.0 baseline: backend (Mercur 2.1.1) does NOT yet produce these fields
 * — vendor_offer aggregation is Phase B territory. Storefront reads
 * `undefined` → LowestPriceBadge stays hidden via AC2 conditional gate.
 *
 * Post Phase B activation: backend story (post-v1.6.0) populates from
 * vendor_offer aggregation; flag flip → badge surfaces.
 */
export interface MultiVendorPricingFields {
  /** Lowest aggregated price (PLN, integer minor units OR string-formatted) — defined by Phase B aggregator. */
  lowest_price_pln?: number | null;
  /** Count of vendors offering this product. Badge renders only when >= 2. */
  vendor_count?: number | null;
  /**
   * Story 5.2 — per-vendor offer list for PDP SellerSelector.
   * Optional in v1.6.0 baseline (DRAFT schema-only). Backend Phase B
   * aggregator populates from vendor_offer table.
   */
  vendor_offers?: VendorOfferOption[];
}

/**
 * Story 5.2 — single vendor offer shape consumed by PDP SellerSelector.
 *
 * Source: aggregated from vendor_offer rows by Phase B backend. v1.6.0
 * storefront treats this as static prop (no runtime fetch). `distance_km`
 * is optional — story 5.3 territory wires geolocation; before then prop
 * arrives undefined and selector hides distance line per AC.
 */
export interface VendorOfferOption {
  seller_id: string;
  seller_name: string;
  /** Storefront seller handle for `/sellers/{handle}` link target
   *  (cleanup-12d AC1 / TF-72): propagated via cart line-item
   *  metadata.selected_seller_handle for CartGroupBySeller "visit seller" link. */
  seller_handle?: string;
  /** Price in PLN (integer minor units OR formatted display number — consumer decides). */
  price_pln: number;
  /** Optional distance from buyer in km. Story 5.3 computes this client-side
   *  via Haversine when caller provides `userLat`/`userLng` to SellerSelector
   *  and the seller has `seller_lat`/`seller_lng`; otherwise undefined.
   */
  distance_km?: number;
  /** Optional seller latitude (Story 5.3). Backend Phase B exposes via
   *  vendor_offer aggregator; v1.6.0 baseline DRAFT — typically undefined.
   */
  seller_lat?: number;
  /** Optional seller longitude (Story 5.3). See `seller_lat`. */
  seller_lng?: number;
}

export interface AdditionalAttributeProps {
  id: string;
  attribute_id: string;
  value: string;
  attribute: {
    id: string;
    name: string;
  };
}

export interface Product {
  id: number;
  brand: string;
  handle: string;
  title: string;
  size: string;
  price: number;
  originalPrice: number;
  thumbnail: string;
  created_at: string;
  sold?: boolean;
}

export type SortOptions = 'price_asc' | 'price_desc' | 'created_at' | 'recommended';

export interface SingleProductImage {
  id: string;
  url: string;
  alt: string;
}

export interface SingleProductReview {
  id: string;
  rating: number;
  username: string;
  created_at: string;
  customer: { first_name: string; last_name: string };
  customer_note: string;
  image: string;
  seller_note?: string;
  updated_at: string;
  seller: SellerProps;
}

export interface SingleProductSeller {
  id: string;
  name: string;
  photo: string;
  /** Real Mercur Seller column (the cart `*seller` wildcard serializes it); used as the
   *  avatar source when the synthesized `photo` is absent. */
  logo?: string | null;
  rating: number;
  reviewCount: number;
  verified: boolean;
  handle: string;
  joinDate: string;
  sold: number;
  description: string;
  reviews?: SingleProductReview[];
  parcel?: string;
  date?: string;
  created_at?: string;
}

export interface SingleProductMeasurement {
  label: string;
  inches: string;
  cm: string;
}

export interface SingleProduct {
  id: string;
  brand: string;
  name: string;
  price: number;
  originalPrice: number;
  color: string;
  colorVariants?: {
    variant: string;
    label: string;
    disabled: boolean;
  }[];
  size: string;
  sizeVariants?: { label: string; disabled: boolean }[];
  condition: string;
  images: SingleProductImage[];
  details: string;
  measurements: SingleProductMeasurement[];
  shippingReturns: string;
  seller: SingleProductSeller;
  reviews: SingleProductReview[];
  tags: string[];
  postedDate: string;
}
