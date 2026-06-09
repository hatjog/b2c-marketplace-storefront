import type { Product } from './product';

type SellerAddress = {
  address_line?: string;
  city?: string;
  country_code?: string;
  postal_code?: string;
  district?: string | null;
};

export type SellerSocialLinks = {
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  tiktok?: string | null;
};

export type SellerGalleryItem = {
  url: string;
  alt?: string | null;
  is_primary?: boolean | null;
};

export type SellerLocation = {
  city?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  district?: string | null;
};

export type SellerOpeningHours = Record<string, { open: string; close: string } | null>;

export type SellerSeoMetadata = {
  meta_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
};

export type SellerProps = SellerAddress & {
  id: string;
  name: string;
  handle: string;
  description: string;
  photo: string;
  tax_id: string;
  created_at: string;
  reviews?: any[];
  products?: Product[];
  email?: string;
  phone?: string;
  lat?: number | null;
  lng?: number | null;
  status?: 'pending_approval' | 'open' | 'suspended' | 'terminated';
  // store_status: Mercur 1.5 legacy field; Mercur 2 uses seller.status (above).
  // Transitional union: accepts BOTH legacy Mercur 1.5 uppercase values
  // ('ACTIVE'/'SUSPENDED'/'INACTIVE') AND Mercur 2 lowercase ('open'/'suspended'/'closed').
  // Required because backward-compat dual-checks (CartItems, ProductDetailsPage,
  // normalize-listed-products) compare against legacy uppercase literals — narrowing the
  // union to lowercase-only would force TS2367 (no-overlap) and silently break the bridge.
  // Remove legacy half once all API responses guarantee seller.status (Mercur 2 native).
  // noqa: mercur15-drift — bridge type union (see comment above)
  store_status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'open' | 'suspended' | 'closed'; // noqa: mercur15-drift
  // Enriched metadata fields (from story 6.1 backend endpoint)
  social_links?: SellerSocialLinks | null;
  gallery?: SellerGalleryItem[] | null;
  opening_hours?: SellerOpeningHours | null;
  seo?: SellerSeoMetadata | null;
  locations?: SellerLocation[] | null;
  regon?: string | null;
  krs?: string | null;
};
