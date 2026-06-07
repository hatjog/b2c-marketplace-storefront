/**
 * Category tile image resolution.
 *
 * The storefront ships a small set of bundled category images at
 * `/images/categories/<handle>.png`. Markets whose category handles are NOT in
 * that set (e.g. BonBeauty beauty categories) have no bundled image — requesting
 * the convention path then 404s and `_next/image` logs a 400 console error.
 *
 * `categoryImageSrc` resolves a guaranteed-valid src: a CMS photo_url if present,
 * else the bundled handle image only when it exists, else the shared placeholder.
 * This keeps the initial <Image> src valid so no 400 is ever requested.
 */
export const CATEGORY_IMAGE_HANDLES = new Set<string>([
  'accessories',
  'boots',
  'sandals',
  'shirt',
  'sneakers',
  'sport',
]);

export const CATEGORY_IMAGE_PLACEHOLDER = '/images/placeholder.svg';

export function categoryImageSrc(handle: string, photoUrl?: string | null): string {
  const trimmed = photoUrl?.trim();
  // Trust an explicit CMS/remote image, but NOT a bundled-convention path
  // (`/images/categories/<handle>.png`) — seeds set that path even for handles
  // with no bundled file, which 404s through next/image. Convention paths are
  // gated by the known-existing set below regardless of where they came from.
  if (trimmed && !trimmed.includes('/images/categories/')) {
    return trimmed;
  }
  if (CATEGORY_IMAGE_HANDLES.has(handle)) {
    return `/images/categories/${handle}.png`;
  }
  return CATEGORY_IMAGE_PLACEHOLDER;
}
