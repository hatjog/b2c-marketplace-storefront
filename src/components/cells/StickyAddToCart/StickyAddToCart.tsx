'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';

import { Button } from '@/components/atoms';
import { useCartContext } from '@/components/providers';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { toast } from '@/lib/helpers/toast';
import type { SellerProps } from '@/types/seller';

import { useTranslations } from 'next-intl';

export const StickyAddToCart = ({
  product,
  countryCode
}: {
  product: HttpTypes.StoreProduct & { seller?: SellerProps };
  countryCode: string;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const { addToCart, isAddingItem } = useCartContext();
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

  const variantId = cheapestVariant?.id || '';
  const { variantPrice } = getProductPrice({ product, variantId });

  const handleAddToCart = async () => {
    if (!variantId) return;

    try {
      await addToCart({ variantId, quantity: 1, countryCode });
    } catch {
      toast.error({
        title: t('error_adding_to_cart'),
        description: ''
      });
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-action-primary px-4 text-action-primary transition-transform duration-300 md:hidden ${
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
        className="bg-primary text-primary"
      >
        {t('add_to_cart')}
      </Button>
    </div>
  );
};
