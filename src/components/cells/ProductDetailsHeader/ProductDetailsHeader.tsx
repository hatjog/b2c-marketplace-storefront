'use client';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { ProductVariants } from '@/components/molecules';
import { Chat } from '@/components/organisms/Chat/Chat';
import { useCartContext } from '@/components/providers';
import useGetAllSearchParams from '@/hooks/useGetAllSearchParams';
import { resolveStorefrontImageSrc } from '@/lib/helpers/asset-reference';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { getMarketId } from '@/lib/helpers/market-filter';
import { toast } from '@/lib/helpers/toast';
import type { SellerProps } from '@/types/seller';
import type { Wishlist } from '@/types/wishlist';

import { WishlistButton } from '../WishlistButton/WishlistButton';

const optionsAsKeymap = (variantOptions: HttpTypes.StoreProductVariant['options']) => {
  return variantOptions?.reduce(
    (acc: Record<string, string>, varopt: HttpTypes.StoreProductOptionValue) => {
      acc[varopt.option?.title.toLowerCase() || ''] = varopt.value;

      return acc;
    },
    {}
  );
};

export const ProductDetailsHeader = ({
  product,
  countryCode,
  user,
  wishlist
}: {
  product: HttpTypes.StoreProduct & { seller?: SellerProps };
  locale: string;
  countryCode: string;
  user: HttpTypes.StoreCustomer | null;
  wishlist?: Wishlist;
}) => {
  // Story 5.5 — selectedSellerId/Name pulled from CartContext shared state;
  // populated przez SellerSelectorCartBridge gdy multi-vendor flag ON
  // (default OFF → wartości pozostają null → addToCart legacy single-vendor flow).
  const {
    addToCart,
    onAddToCart,
    cart,
    isAddingItem,
    selectedSellerId,
    selectedSellerName
  } = useCartContext();
  const { allSearchParams } = useGetAllSearchParams();
  const t = useTranslations('products');
  const marketId = getMarketId();

  const { cheapestVariant, cheapestPrice } = getProductPrice({
    product
  });

  // Check if product has any valid prices in current region
  const hasAnyPrice = cheapestPrice !== null && cheapestVariant !== null;

  // set default variant
  const selectedVariant = hasAnyPrice
    ? {
        ...optionsAsKeymap(cheapestVariant.options ?? null),
        ...allSearchParams
      }
    : allSearchParams;

  // get selected variant id
  const variantId =
    product.variants?.find(({ options }: { options: any }) =>
      options?.every((option: any) =>
        selectedVariant[option.option?.title.toLowerCase() || '']?.includes(option.value)
      )
    )?.id || '';

  // get variant price
  const { variantPrice } = getProductPrice({
    product,
    variantId
  });

  const selectedVariantData = product.variants?.find(({ id }) => id === variantId);
  const variantStock =
    selectedVariantData?.manage_inventory === false
      ? Infinity
      : (selectedVariantData?.inventory_quantity || 0);

  const variantHasPrice = !!selectedVariantData?.calculated_price;

  const isVariantStockMaxLimitReached =
    variantStock !== Infinity &&
    (cart?.items?.find(item => item.variant_id === variantId)?.quantity ?? 0) >= variantStock;

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!variantId || !hasAnyPrice || isVariantStockMaxLimitReached) return;

    const subtotal = +(variantPrice?.calculated_price_without_tax_number || 0);
    const total = +(variantPrice?.calculated_price_number || 0);

    const storeCartLineItem = {
      thumbnail: resolveStorefrontImageSrc(product.thumbnail, marketId),
      product_title: product.title,
      quantity: 1,
      subtotal,
      total,
      tax_total: total - subtotal,
      variant_id: variantId,
      product_id: product.id,
      variant: product.variants?.find(({ id }) => id === variantId)
    };

    // Optimistic update
    onAddToCart(storeCartLineItem, variantPrice?.currency_code || 'eur');

    try {
      await addToCart({
        variantId: variantId,
        quantity: 1,
        countryCode,
        // Story 5.5 — propagate multi-vendor seller selection;
        // null when flag OFF → metadata not attached → legacy flow.
        selectedSellerId,
        selectedSellerName
      });
    } catch {
      toast.error({
        title: t('error_adding_to_cart'),
        description: t('error_adding_to_cart_desc')
      });
    }
  };

  const isAddToCartDisabled =
    !variantStock || !variantHasPrice || !hasAnyPrice || isVariantStockMaxLimitReached;

  return (
    <div
      className="bb-section-shell bb-section-shell-strong space-y-6"
      data-testid="product-details-header"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          {product.seller?.name && <span className="bb-pill">{product.seller.name}</span>}
          <h1 className="heading-lg text-primary" data-testid="product-title">
            {product.title}
          </h1>
          <div className="flex items-center gap-2" data-testid="product-price-container">
            {hasAnyPrice && variantPrice ? (
              <>
                <span className="text-[28px] font-medium text-primary md:text-[34px]" data-testid="product-price-current">
                  {variantPrice.calculated_price}
                </span>
                {variantPrice.calculated_price_number !== variantPrice.original_price_number && (
                  <span className="label-md text-secondary line-through" data-testid="product-price-original">
                    {variantPrice.original_price}
                  </span>
                )}
              </>
            ) : (
              <span className="label-md pb-4 pt-2 text-secondary" data-testid="product-price-unavailable">
                {t('not_available_in_region')}
              </span>
            )}
          </div>
        </div>
        <div>
          <WishlistButton
            productId={product.id}
            wishlist={wishlist}
            user={user}
          />
        </div>
      </div>
      {hasAnyPrice && (
        <div className="bb-card-muted">
          <ProductVariants
            product={product}
            selectedVariant={selectedVariant}
          />
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row">
        <Button
          onClick={handleAddToCart}
          disabled={isAddToCartDisabled}
          loading={isAddingItem}
          className="flex w-full justify-center rounded-full bg-[var(--cta)] py-4 text-white hover:bg-[var(--cta-hover)] md:flex-1"
          size="large"
          data-testid="product-add-to-cart-button"
        >
          {!hasAnyPrice
            ? t('not_available_in_region')
            : variantStock && variantHasPrice
              ? t('add_to_cart')
              : t('out_of_stock')}
        </Button>

        {user && product.seller && (
          <Chat
            user={user}
            seller={product.seller}
            buttonClassNames="w-full rounded-full bg-[rgba(9,9,9,0.06)] text-primary hover:bg-[rgba(9,9,9,0.12)] md:w-auto"
            product={product}
          />
        )}
      </div>
    </div>
  );
};
