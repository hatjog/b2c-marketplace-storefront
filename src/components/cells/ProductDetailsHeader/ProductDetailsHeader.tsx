'use client';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { ProductVariants } from '@/components/molecules';
import { Chat } from '@/components/organisms/Chat/Chat';
import { useCartContext } from '@/components/providers';
import useGetAllSearchParams from '@/hooks/useGetAllSearchParams';
import { getProductPrice } from '@/lib/helpers/get-product-price';
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
  locale,
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
  const { addToCart, onAddToCart, cart, isAddingItem } = useCartContext();
  const { allSearchParams } = useGetAllSearchParams();
  const t = useTranslations('products');

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
      thumbnail: product.thumbnail || '',
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
        countryCode
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
      className="rounded-sm border p-5"
      data-testid="product-details-header"
    >
      <div className="flex justify-between">
        <div>
          <h2 className="label-md text-secondary">{/* {product?.brand || "No brand"} */}</h2>
          <h1
            className="heading-lg text-primary"
            data-testid="product-title"
          >
            {product.title}
          </h1>
          <div
            className="mt-2 flex items-center gap-2"
            data-testid="product-price-container"
          >
            {hasAnyPrice && variantPrice ? (
              <>
                <span
                  className="heading-md text-primary"
                  data-testid="product-price-current"
                >
                  {variantPrice.calculated_price_number === 0 ? 'Gratis' : variantPrice.calculated_price}
                </span>
                {variantPrice.calculated_price_number !== 0 && variantPrice.calculated_price_number !== variantPrice.original_price_number && (
                  <span
                    className="label-md text-secondary line-through"
                    data-testid="product-price-original"
                  >
                    {variantPrice.original_price}
                  </span>
                )}
              </>
            ) : (
              <span
                className="label-md pb-4 pt-2 text-secondary"
                data-testid="product-price-unavailable"
              >
                {t('not_available_in_region')}
              </span>
            )}
          </div>
        </div>
        <div>
          {/* Add to Wishlist */}
          <WishlistButton
            productId={product.id}
            wishlist={wishlist}
            user={user}
          />
        </div>
      </div>
      {/* Product Variants */}
      {hasAnyPrice && (
        <ProductVariants
          product={product}
          selectedVariant={selectedVariant}
        />
      )}
      {/* Add to Cart */}
      <Button
        onClick={handleAddToCart}
        disabled={isAddToCartDisabled}
        loading={isAddingItem}
        className="mb-4 flex w-full justify-center py-3"
        size="large"
        data-testid="product-add-to-cart-button"
      >
        {variantStock && variantHasPrice
          ? t('add_to_cart')
          : t('out_of_stock')}
      </Button>
      {!hasAnyPrice && (
        <p
          className="label-sm mb-2 text-center text-secondary"
          data-testid="product-temporarily-unavailable"
        >
          {t('temporarily_unavailable')}
        </p>
      )}
      {/* Seller message */}

      {user && product.seller && (
        <Chat
          user={user}
          seller={product.seller}
          buttonClassNames="w-full"
          product={product}
        />
      )}
    </div>
  );
};
