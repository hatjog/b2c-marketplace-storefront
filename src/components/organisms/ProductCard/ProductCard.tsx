'use client';

import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';

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

  return (
    <div
      className={cn(
        'group relative flex w-full min-w-[250px] flex-col justify-between rounded-sm border p-1 lg:w-[calc(25%-1rem)]',
        className
      )}
      data-testid="product-card"
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
        >
          <div className="align-center flex h-full w-full justify-center overflow-hidden rounded-sm">
            {product.thumbnail ? (
              <Image
                priority
                fetchPriority="high"
                src={decodeURIComponent(product.thumbnail)}
                alt={t('image_alt', { name: productName })}
                width={100}
                height={100}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="aspect-square h-full w-full rounded-xs object-cover object-center transition-all duration-300 lg:group-hover:-mt-14"
                data-testid="product-card-image"
              />
            ) : (
              <Image
                priority
                fetchPriority="high"
                src="/images/placeholder.svg"
                alt={t('image_placeholder_alt', { name: productName })}
                width={100}
                height={100}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
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
    </div>
  );
};
