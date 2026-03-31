import type { HttpTypes } from '@medusajs/types';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export interface GpSeoMetadata {
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
}

/**
 * Resolves GP SEO metadata from entity metadata using fallback chain:
 * metadata.gp.seo.* → metadata.seo.* (backward-compat, remove in v1.4.0) → undefined
 */
export function resolveGpSeoMetadata(
  metadata: Record<string, unknown> | null | undefined
): GpSeoMetadata {
  const gp = metadata?.gp as Record<string, unknown> | undefined;
  const gpSeo = gp?.seo as GpSeoMetadata | undefined;
  // backward-compat: flat metadata.seo.* (remove in v1.4.0)
  const legacySeo = metadata?.seo as GpSeoMetadata | undefined;
  return {
    meta_title: gpSeo?.meta_title ?? legacySeo?.meta_title,
    meta_description: gpSeo?.meta_description ?? legacySeo?.meta_description,
    og_image_url: gpSeo?.og_image_url ?? legacySeo?.og_image_url,
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
  const gpVendor = (
    (product?.metadata?.gp as Record<string, unknown> | undefined)?.vendor_name as string | undefined
  ) ?? siteName;

  const title = seo.meta_title ?? product?.title ?? siteName;
  const description =
    seo.meta_description ??
    `${product?.title} — voucher na zabieg w ${gpVendor}. Kup na ${siteName}.`;
  const ogImage =
    seo.og_image_url ??
    product?.thumbnail ??
    `${protocol}://${host}/images/placeholder.svg`;

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
  const ogImage =
    seo.og_image_url ?? `${protocol}://${host}/images/placeholder.svg`;

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
  const ogImage =
    seo.og_image_url ?? `${baseUrl}/images/placeholder.svg`;

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
