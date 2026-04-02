import type { HttpTypes } from '@medusajs/types';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getGpField } from './metadata-utils';

/**
 * Returns `url` unless it points to an SVG file, in which case returns `fallback`.
 * SVG is not supported as OG image by Facebook, Twitter/X, LinkedIn, or Slack crawlers.
 */
export function toSafeOgImageUrl(
  url: string | null | undefined,
  fallback: string
): string {
  if (!url) return fallback;
  // Block SVG data URIs (unsupported by social crawlers, not remotely fetchable)
  if (url.toLowerCase().startsWith('data:image/svg')) return fallback;
  // Strip query string and fragment before checking extension
  const cleanUrl = url.split('?')[0].split('#')[0];
  if (cleanUrl.toLowerCase().endsWith('.svg')) return fallback;
  return url;
}

export interface GpSeoMetadata {
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
}

/**
 * Resolves GP SEO metadata from entity metadata using ADR-054 namespace:
 * metadata.gp.seo.* → undefined
 */
export function resolveGpSeoMetadata(
  metadata: Record<string, unknown> | null | undefined
): GpSeoMetadata {
  const gpSeo = getGpField<GpSeoMetadata>(metadata, 'seo');
  return {
    meta_title: gpSeo?.meta_title,
    meta_description: gpSeo?.meta_description,
    og_image_url: gpSeo?.og_image_url,
  };
}

export const generateProductMetadata = async (
  product: HttpTypes.StoreProduct
): Promise<Metadata> => {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  const seo = resolveGpSeoMetadata(product?.metadata as Record<string, unknown> | null | undefined);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  const gpVendor = getGpField<string>(product?.metadata as Record<string, unknown>, 'vendor_name') ?? siteName;

  const title = seo.meta_title ?? product?.title ?? siteName;
  const description =
    seo.meta_description ??
    `${product?.title} — voucher na zabieg w ${gpVendor}. Kup na ${siteName}.`;
  const ogImageRaw =
    seo.og_image_url ??
    product?.thumbnail ??
    null;
  const ogImage = toSafeOgImageUrl(ogImageRaw, `${protocol}://${host}/B2C_Storefront_Open_Graph.png`);

  return {
    title,
    description,
    robots: 'index, follow',
    metadataBase: new URL(`${protocol}://${host}/products/${product?.handle}`),

    openGraph: {
      title,
      description,
      url: `${protocol}://${host}/products/${product?.handle}`,
      siteName,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title
        }
      ],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage]
    }
  };
};

export const generateCategoryMetadata = async (
  category: HttpTypes.StoreProductCategory
): Promise<Metadata> => {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  const seo = resolveGpSeoMetadata(
    category?.metadata as Record<string, unknown> | null | undefined
  );

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  const title = seo.meta_title ?? category.name;
  const description =
    seo.meta_description ??
    `${category.name} — zabiegi i vouchery na ${siteName}.`;
  const ogImage = toSafeOgImageUrl(
    seo.og_image_url,
    `${protocol}://${host}/B2C_Storefront_Open_Graph.png`
  );

  return {
    robots: 'index, follow',
    metadataBase: new URL(`${protocol}://${host}/categories/${category.handle}`),
    title,
    description,

    openGraph: {
      title,
      description,
      url: `${protocol}://${host}/categories/${category.handle}`,
      siteName,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title
        }
      ],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage]
    }
  };
};

export const generateCollectionMetadata = (
  collection: HttpTypes.StoreCollection,
  baseUrl: string,
  locale: string
): Metadata => {
  const seo = resolveGpSeoMetadata(
    collection?.metadata as Record<string, unknown> | null | undefined
  );

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  const title = seo.meta_title ?? collection.title;
  const description =
    seo.meta_description ??
    `${collection.title} — zabiegi i vouchery na ${siteName}.`;
  const canonical = new URL(`/${locale}/collections/${collection.handle}`, `${baseUrl}/`).toString();
  const ogImage = toSafeOgImageUrl(seo.og_image_url, `${baseUrl}/B2C_Storefront_Open_Graph.png`);

  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      images: [
        {
          url: ogImage,
          alt: title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage]
    }
  };
};
