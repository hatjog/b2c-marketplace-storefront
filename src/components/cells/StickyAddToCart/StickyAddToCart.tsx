'use client';

import { useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { useCartContext } from '@/components/providers';
import useGetAllSearchParams from '@/hooks/useGetAllSearchParams';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { toast } from '@/lib/helpers/toast';
import { buildEntitlementLineItemMetadata } from '@/lib/voucher/entitlement-metadata';
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

function DotTrio({ label }: { label: string }) {
  return (
    <span
      className="inline-flex min-h-[1.25rem] items-center justify-center gap-1"
      role="status"
      aria-label={label}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
    </span>
  );
}

export const StickyAddToCart = ({
  product,
  countryCode
}: {
  product: HttpTypes.StoreProduct & { seller?: SellerProps };
  countryCode: string;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  // Story 5.5 — selectedSellerId/Name from CartContext shared state.
  // TF-72: also pull selectedSellerHandle for "visit seller" link propagation.
  const {
    addToCart,
    isAddingItem,
    selectedSellerId,
    selectedSellerName,
    selectedSellerHandle,
    purchaseMode
  } = useCartContext();
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

    // Story 1.10.1 — derive embedded entitlement_profile triad from
    // product.metadata.gp.entitlement_profile so payment.captured can resolve
    // it and issue entitlement_instance (parity with PDP CTA).
    const entitlement = buildEntitlementLineItemMetadata(
      product,
      typeof variantPrice?.calculated_price_number === 'number'
        ? Math.round(variantPrice.calculated_price_number * 100)
        : null
    );

    try {
      await addToCart({
        variantId,
        quantity: 1,
        countryCode,
        // Story 5.5 — multi-vendor seller context (null when flag OFF).
        // TF-72: also propagate handle for "visit seller" link in CartGroupBySeller.
        selectedSellerId,
        selectedSellerName,
        selectedSellerHandle,
        purchaseMode,
        entitlement
      });
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
        disabled={isAddingItem}
        size="small"
        className="rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
      >
        {isAddingItem ? <DotTrio label={t('adding_to_cart')} /> : t('add_to_cart')}
      </Button>
    </div>
  );
};
