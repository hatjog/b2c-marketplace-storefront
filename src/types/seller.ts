import type { Product } from './product';

type SellerAddress = {
  address_line?: string;
  city?: string;
  country_code?: string;
  postal_code?: string;
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
};

export type SellerOpeningHours = Record<string, { open: string; close: string } | null>;

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
  status?: 'pending_approval' | 'open' | 'suspended' | 'terminated';
  store_status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  // Enriched metadata fields (from story 6.1 backend endpoint)
  social_links?: SellerSocialLinks | null;
  gallery?: SellerGalleryItem[] | null;
  opening_hours?: SellerOpeningHours | null;
  locations?: SellerLocation[] | null;
};
