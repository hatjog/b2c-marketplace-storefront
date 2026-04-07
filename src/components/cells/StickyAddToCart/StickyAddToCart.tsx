'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { useCartContext } from '@/components/providers';
import useGetAllSearchParams from '@/hooks/useGetAllSearchParams';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { toast } from '@/lib/helpers/toast';
import type { SellerProps } from '@/types/seller';

const optionsAsKeymap = (variantOptions: HttpTypes.StoreProductVariant['options']) => {
  return variantOptions?.reduce(
    (acc: Record<string, string>, varopt: HttpTypes.StoreProductOptionValue) => {
      acc[varopt.option?.title.toLowerCase() || ''] = varopt.value;
      return acc;
    },
    {}
  );
};

export const StickyAddToCart = ({
  product,
  countryCode
}: {
  product: HttpTypes.StoreProduct & { seller?: SellerProps };
  countryCode: string;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const { addToCart, isAddingItem } = useCartContext();
  const { allSearchParams } = useGetAllSearchParams();
  const t = useTranslations('products');

  useEffect(() => {
    const target = document.querySelector('[data-testid="product-add-to-cart-button"]');
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const { cheapestVariant, cheapestPrice } = getProductPrice({ product });
  const hasAnyPrice = cheapestPrice !== null && cheapestVariant !== null;

  if (!hasAnyPrice) return null;

  // Resolve selected variant from URL params (same logic as ProductDetailsHeader)
  const selectedVariant = {
    ...optionsAsKeymap(cheapestVariant.options ?? null),
    ...allSearchParams
  };

  const variantId =
    product.variants?.find(({ options }: { options: any }) =>
      options?.every((option: any) =>
        selectedVariant[option.option?.title.toLowerCase() || '']?.includes(option.value)
      )
    )?.id || '';

  const { variantPrice } = getProductPrice({ product, variantId });

  const handleAddToCart = async () => {
    if (!variantId) return;

    try {
      await addToCart({ variantId, quantity: 1, countryCode });
    } catch {
      toast.error({
        title: t('error_adding_to_cart'),
        description: t('error_adding_to_cart_desc')
      });
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-[rgba(144,112,50,0.18)] bg-[rgba(255,249,240,0.95)] px-4 py-3 text-primary shadow-[0_-10px_30px_rgba(37,28,12,0.08)] backdrop-blur transition-transform duration-300 lg:hidden ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <span className="label-md font-semibold">
        {t('price_label')}: {variantPrice?.calculated_price}
      </span>
      <Button
        onClick={handleAddToCart}
        loading={isAddingItem}
        size="small"
        className="rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
      >
        {t('add_to_cart')}
      </Button>
    </div>
  );
};
