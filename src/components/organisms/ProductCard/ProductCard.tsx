'use client';

import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';

const PLACEHOLDER_CDN_HOST = 'cdn.example.com';
const PLACEHOLDER_IMAGE_SRC = '/images/placeholder.svg';

function resolveThumbnailSrc(thumbnail: string | null | undefined) {
  if (!thumbnail) {
    return PLACEHOLDER_IMAGE_SRC;
  }

  const decodedThumbnail = decodeURIComponent(thumbnail);

  try {
    const parsedUrl = new URL(decodedThumbnail);
    if (parsedUrl.hostname === PLACEHOLDER_CDN_HOST) {
      return PLACEHOLDER_IMAGE_SRC;
    }

    return decodedThumbnail;
  } catch {
    return decodedThumbnail.startsWith('/') ? decodedThumbnail : PLACEHOLDER_IMAGE_SRC;
  }
}

export const ProductCard = ({
  product,
  className
}: {
  product: HttpTypes.StoreProduct | Product;
  className?: string;
}) => {
  const t = useTranslations('products');

  if (!product) {
    return null;
  }

  const { cheapestPrice } = getProductPrice({ product: product as HttpTypes.StoreProduct });

  const productName = String(product.title || t('fallback_name'));
  const thumbnailSrc = resolveThumbnailSrc(product.thumbnail);
  const seller = (product as any).seller as { name: string; handle: string } | undefined;
  const usesPlaceholderImage = thumbnailSrc === PLACEHOLDER_IMAGE_SRC;

  return (
    <div
      className={cn(
        'group relative flex w-full flex-col justify-between rounded-sm border p-1',
        className
      )}
      data-testid="product-item"
      data-product-handle={product.handle}
    >
      <div
        className="relative aspect-square h-full w-full bg-primary"
        data-testid="product-card-image-container"
      >
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          aria-label={t('view_aria', { name: productName })}
          title={t('view_aria', { name: productName })}
          data-testid="product-card-link"
          data-product-handle={product.handle}
        >
          <div className="align-center flex h-full w-full justify-center overflow-hidden rounded-sm">
            {!usesPlaceholderImage ? (
              <Image
                priority
                fetchPriority="high"
                src={thumbnailSrc}
                alt={t('image_alt', { name: productName })}
                width={100}
                height={100}
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                className="aspect-square h-full w-full rounded-xs object-cover object-center transition-all duration-300 lg:group-hover:-mt-14"
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
                data-testid="product-card-placeholder-image"
              />
            )}
          </div>
        </LocalizedClientLink>
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          aria-label={t('view_aria', { name: productName })}
          title={t('view_aria', { name: productName })}
        >
          <Button
            className="absolute bottom-1 z-10 hidden h-auto w-full rounded-sm bg-action uppercase text-action-on-primary lg:h-[48px] lg:group-hover:block"
            data-testid="product-card-see-more-button"
          >
            {t('see_more')}
          </Button>
        </LocalizedClientLink>
      </div>
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        aria-label={t('go_to_product_aria', { name: productName })}
        title={t('go_to_product_aria', { name: productName })}
      >
        <div
          className="flex justify-between p-4"
          data-testid="product-card-info"
        >
          <div className="w-full">
            <h3
              className="heading-sm truncate"
              data-testid="product-card-title"
            >
              {product.title}
            </h3>
            <div
              className="mt-2 flex items-center gap-2"
              data-testid="product-card-price"
            >
              <p
                className="font-medium"
                data-testid="product-card-current-price"
              >
                {cheapestPrice?.calculated_price}
              </p>
              {cheapestPrice?.calculated_price !== cheapestPrice?.original_price && (
                <p
                  className="text-sm text-gray-500 line-through"
                  data-testid="product-card-original-price"
                >
                  {cheapestPrice?.original_price}
                </p>
              )}
            </div>
          </div>
        </div>
      </LocalizedClientLink>
      {seller && (
        <div
          className="px-4 pb-3"
          data-testid="product-card-vendor"
        >
          <LocalizedClientLink
            href={`/salony/${seller.handle}`}
            aria-label={`Salon: ${seller.name}`}
          >
            <span
              className="label-sm text-secondary"
              data-testid="product-card-vendor-name"
            >
              {seller.name}
            </span>
          </LocalizedClientLink>
        </div>
      )}
    </div>
  );
};
