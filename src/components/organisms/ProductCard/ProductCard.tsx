'use client';

import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { LowestPriceBadge } from '@/components/atoms/LowestPriceBadge/LowestPriceBadge';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { cn } from '@/lib/utils';
import type { MultiVendorPricingFields, Product } from '@/types/product';

/**
 * Story 5.1 — multi-vendor pricing feature flag.
 * Default OFF (`'false'`) → badge hidden across whole app.
 * Phase B activation (post-v1.6.0) flips this to surface lowest-price prefix.
 */
const MULTI_VENDOR_PRICING_ENABLED = isMultiVendorEnabled();

const PLACEHOLDER_CDN_HOST = 'cdn.example.com';
const PLACEHOLDER_IMAGE_SRC = '/images/placeholder.svg';

function resolveThumbnailSrc(thumbnail: string | null | undefined) {
  if (!thumbnail) {
    return PLACEHOLDER_IMAGE_SRC;
  }

  try {
    const decodedThumbnail = safeDecodeURIComponent(thumbnail);
    const parsedUrl = new URL(decodedThumbnail);
    if (parsedUrl.hostname === PLACEHOLDER_CDN_HOST) {
      return PLACEHOLDER_IMAGE_SRC;
    }

    return decodedThumbnail;
  } catch {
    return thumbnail.startsWith('/') ? thumbnail : PLACEHOLDER_IMAGE_SRC;
  }
}

export const ProductCard = ({
  product,
  className,
  showPrice = true,
  showVendor = true,
  fromContext,
}: {
  product: HttpTypes.StoreProduct | Product;
  className?: string;
  showPrice?: boolean;
  showVendor?: boolean;
  /**
   * Story v160-4-6: when present, augments product hrefs with
   * `?from=seller:{handle}` so the PDP knows to render SalonContextChip.
   * Only set when ProductCard is rendered in salon-anchored context (e.g.
   * SellerTabs ProductListing). Other surfaces (search, category, home) leave
   * this undefined → links stay clean.
   */
  fromContext?: { type: 'seller'; handle: string };
}) => {
  const t = useTranslations('products');

  if (!product) {
    return null;
  }

  // Story v160-4-6: build product href with optional `?from=seller:` suffix.
  const fromQuery =
    fromContext?.type === 'seller' ? `?from=seller:${fromContext.handle}` : '';
  const productHref = `/products/${product.handle}${fromQuery}`;

  const { cheapestPrice } = getProductPrice({ product: product as HttpTypes.StoreProduct });

  const productName = String(product.title || t('fallback_name'));
  const thumbnailSrc = resolveThumbnailSrc(product.thumbnail);
  const seller = (product as HttpTypes.StoreProduct & { seller?: { name: string; handle: string } }).seller;
  const usesPlaceholderImage = thumbnailSrc === PLACEHOLDER_IMAGE_SRC;
  const sellerReviews = Array.isArray((seller as { reviews?: Array<{ rating?: number | null } | null> } | undefined)?.reviews)
    ? (seller as { reviews?: Array<{ rating?: number | null } | null> }).reviews?.filter(Boolean) ?? []
    : [];
  const reviewCount = sellerReviews.length;
  const rating = reviewCount
    ? sellerReviews.reduce((sum, review) => sum + Number(review?.rating ?? 0), 0) / reviewCount
    : null;
  const sellerLocation =
    (seller as { city?: string | null; address_line?: string | null } | undefined)?.city?.trim() ||
    (seller as { city?: string | null; address_line?: string | null } | undefined)?.address_line?.trim() ||
    null;

  return (
    <div
      className={cn(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-[rgba(144,112,50,0.14)] bg-[rgba(255,255,255,0.84)] p-2 shadow-[0_16px_40px_rgba(90,67,28,0.08)] transition-transform duration-300 hover:-translate-y-1',
        className
      )}
      data-testid="product-item"
      data-product-handle={product.handle}
    >
      <div
        className="relative aspect-[4/5] h-full w-full overflow-hidden rounded-[22px] bg-primary"
        data-testid="product-card-image-container"
      >
        {showVendor && seller?.name && (
          <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-24px)]">
            <span className="bb-pill max-w-full truncate">{seller.name}</span>
          </div>
        )}
        <LocalizedClientLink
          href={productHref}
          aria-label={t('view_aria', { name: productName })}
          title={t('view_aria', { name: productName })}
          data-testid="product-card-link"
          data-product-handle={product.handle}
          className="block h-full"
        >
          <div className="align-center flex h-full w-full justify-center overflow-hidden rounded-[22px]">
            {!usesPlaceholderImage ? (
              <Image
                priority
                fetchPriority="high"
                src={thumbnailSrc}
                alt={t('image_alt', { name: productName })}
                width={100}
                height={100}
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                className="aspect-[4/5] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                data-testid="product-card-image"
              />
            ) : (
              <Image
                priority
                fetchPriority="high"
                src={PLACEHOLDER_IMAGE_SRC}
                alt={t('image_placeholder_alt', { name: productName })}
                width={100}
                height={100}
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                className="h-full w-full object-contain p-10"
                data-testid="product-card-placeholder-image"
              />
            )}
          </div>
        </LocalizedClientLink>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4" data-testid="product-card-info">
        <LocalizedClientLink
          href={productHref}
          aria-label={t('go_to_product_aria', { name: productName })}
          title={t('go_to_product_aria', { name: productName })}
          className="space-y-3"
        >
          <div className="space-y-2">
            <h3 className="heading-sm line-clamp-2" data-testid="product-card-title">
              {product.title}
            </h3>
            <div className="flex flex-wrap gap-2 text-[13px] text-secondary">
              {rating != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(239,229,210,0.72)] px-2.5 py-1">
                  <span className="text-[var(--gold)]">★</span>
                  <span>{rating.toFixed(1)}</span>
                  <span>·</span>
                  <span>{t('reviews_count', { count: reviewCount })}</span>
                </span>
              )}
              {sellerLocation && (
                <span className="inline-flex items-center rounded-full bg-[rgba(239,229,210,0.42)] px-2.5 py-1">
                  {sellerLocation}
                </span>
              )}
            </div>
          </div>
          {showPrice && (
            <div className="flex flex-col gap-1" data-testid="product-card-price">
              {MULTI_VENDOR_PRICING_ENABLED &&
                typeof (product as Product & MultiVendorPricingFields).vendor_count === 'number' && (
                  <MultiVendorIndicator
                    vendorCount={
                      (product as Product & MultiVendorPricingFields).vendor_count as number
                    }
                  />
                )}
              <div className="flex items-center gap-2">
                {MULTI_VENDOR_PRICING_ENABLED &&
                  typeof (product as Product & MultiVendorPricingFields).vendor_count === 'number' &&
                  typeof (product as Product & MultiVendorPricingFields).lowest_price_pln === 'number' && (
                    <LowestPriceBadge
                      vendorCount={
                        (product as Product & MultiVendorPricingFields).vendor_count as number
                      }
                    />
                  )}
                <p className="text-lg font-medium text-primary" data-testid="product-card-current-price">
                  {cheapestPrice?.calculated_price}
                </p>
                {cheapestPrice?.calculated_price !== cheapestPrice?.original_price && (
                  <p className="text-sm text-gray-500 line-through" data-testid="product-card-original-price">
                    {cheapestPrice?.original_price}
                  </p>
                )}
              </div>
            </div>
          )}
        </LocalizedClientLink>
        <div className="mt-auto flex items-center justify-between gap-3">
          {showVendor && seller && (
            <LocalizedClientLink
              href={`/sellers/${seller.handle}`}
              aria-label={t('seller_aria', { name: seller.name })}
              className="label-sm text-secondary transition-opacity hover:opacity-70"
              data-testid="product-card-vendor"
            >
              {seller.name}
            </LocalizedClientLink>
          )}
          <LocalizedClientLink
            href={productHref}
            aria-label={t('view_aria', { name: productName })}
            title={t('view_aria', { name: productName })}
            className="bb-primary-cta ml-auto min-h-[44px] rounded-full px-4 py-2 text-[12px]"
            data-testid="product-card-see-more-button"
          >
            {t('see_more')}
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  );
};
