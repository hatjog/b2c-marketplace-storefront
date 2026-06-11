'use client';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { GiftModeToggle } from '@/components/atoms/GiftModeToggle/GiftModeToggle';
import { ProductVariants } from '@/components/molecules';
import { hasVisibleVariantOptions } from '@/components/molecules/ProductVariants/ProductVariants';
import { Chat } from '@/components/organisms/Chat/Chat';
import { useCartContext } from '@/components/providers';
import useGetAllSearchParams from '@/hooks/useGetAllSearchParams';
import { resolveStorefrontImageSrc } from '@/lib/helpers/asset-reference';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { getMarketId } from '@/lib/helpers/market-filter';
import { toast } from '@/lib/helpers/toast';
import { buildEntitlementLineItemMetadata } from '@/lib/voucher/entitlement-metadata';
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

function DotTrio({ label }: { label: string }) {
  return (
    <span
      className="inline-flex min-h-[1.5rem] items-center justify-center gap-1"
      role="status"
      aria-label={label}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
    </span>
  );
}

export const ProductDetailsHeader = ({
  product,
  countryCode,
  user,
  wishlist,
  initialPrice
}: {
  product: HttpTypes.StoreProduct & { seller?: SellerProps; subtitle?: string | null };
  locale: string;
  countryCode: string;
  user: HttpTypes.StoreCustomer | null;
  wishlist?: Wishlist;
  initialPrice?: {
    variantId: string;
    calculated_price: string;
    calculated_price_number: number;
    calculated_price_without_tax_number: number;
    original_price: string;
    original_price_number: number;
    currency_code: string;
    inventory_quantity: number | null;
  } | null;
}) => {
  // Story 5.5 — selectedSellerId/Name pulled from CartContext shared state;
  // populated przez SellerSelectorCartBridge gdy multi-vendor flag ON
  // (default OFF → wartości pozostają null → addToCart legacy single-vendor flow).
  // TF-72: also pull selectedSellerHandle for "visit seller" link propagation.
  const {
    addToCart,
    onAddToCart,
    cart,
    isAddingItem,
    selectedSellerId,
    selectedSellerName,
    selectedSellerHandle,
    purchaseMode
  } = useCartContext();
  const { allSearchParams } = useGetAllSearchParams();
  const t = useTranslations('products');
  const marketId = getMarketId();

  const { cheapestVariant, cheapestPrice } = getProductPrice({
    product
  });
  const fallbackPrice = initialPrice
    ? {
        calculated_price: initialPrice.calculated_price,
        calculated_price_number: initialPrice.calculated_price_number,
        calculated_price_without_tax_number: initialPrice.calculated_price_without_tax_number,
        original_price: initialPrice.original_price,
        original_price_number: initialPrice.original_price_number,
        currency_code: initialPrice.currency_code
      }
    : null;
  const fallbackVariant = initialPrice?.variantId
    ? ({
        id: initialPrice.variantId,
        inventory_quantity: initialPrice.inventory_quantity
      } as HttpTypes.StoreProductVariant)
    : null;

  // Check if product has any valid prices in current region
  const hasAnyPrice =
    (cheapestPrice ?? fallbackPrice) !== null && (cheapestVariant ?? fallbackVariant) !== null;

  // set default variant
  const selectedVariant = hasAnyPrice
    ? {
        ...optionsAsKeymap((cheapestVariant ?? fallbackVariant)?.options ?? null),
        ...allSearchParams
      }
    : allSearchParams;

  // get selected variant id
  const variantId =
    product.variants?.find(({ options }: { options: any }) =>
      options?.every((option: any) =>
        selectedVariant[option.option?.title.toLowerCase() || '']?.includes(option.value)
      )
    )?.id ||
    initialPrice?.variantId ||
    '';

  // get variant price
  const { variantPrice: computedVariantPrice } = getProductPrice({
    product,
    variantId
  });
  const variantPrice =
    computedVariantPrice ?? (variantId === initialPrice?.variantId ? fallbackPrice : null);

  const selectedVariantData =
    product.variants?.find(({ id }) => id === variantId) ?? fallbackVariant;
  const variantStock =
    selectedVariantData?.manage_inventory === false
      ? Infinity
      : typeof selectedVariantData?.inventory_quantity === 'number'
        ? selectedVariantData.inventory_quantity
        : variantId === initialPrice?.variantId
          ? Infinity
          : 0;

  const variantHasPrice =
    !!selectedVariantData?.calculated_price || variantId === initialPrice?.variantId;

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
      variant: product.variants?.find(({ id }) => id === variantId),
      metadata: {
        purchase_mode: purchaseMode,
        is_gift: purchaseMode === 'gift'
      }
    };

    // Optimistic update
    onAddToCart(storeCartLineItem, variantPrice?.currency_code || 'eur');

    // Story 1.10.1 — derive embedded entitlement_profile triad from
    // product.metadata.gp.entitlement_profile (set by gp-config-sync-catalog
    // from market.yaml + products.yaml entitlement_profile_id). Undefined for
    // non-voucher SKUs → metadata stays clean (legacy flow).
    const entitlement = buildEntitlementLineItemMetadata(
      product,
      // `calculated_price_number` is ALREADY in minor units (grosze) — it is the
      // raw `calculated_amount[_with_tax]` (see get-product-price.ts), and
      // buildEntitlementLineItemMetadata expects `amountMinor` in grosze too.
      // The previous `* 100` double-scaled it → entitlement amount_minor was 100×.
      typeof variantPrice?.calculated_price_number === 'number'
        ? Math.round(variantPrice.calculated_price_number)
        : null
    );

    try {
      await addToCart({
        variantId: variantId,
        quantity: 1,
        countryCode,
        // Story 5.5 — propagate multi-vendor seller selection;
        // null when flag OFF → metadata not attached → legacy flow.
        // TF-72: also propagate handle for "visit seller" link in CartGroupBySeller.
        selectedSellerId,
        selectedSellerName,
        // cleanup-12d AC1 — propagate seller handle.
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

  const isAddToCartDisabled =
    !variantStock || !variantHasPrice || !hasAnyPrice || isVariantStockMaxLimitReached;

  return (
    <div
      className="bb-section-shell bb-section-shell-strong space-y-6"
      data-testid="product-details-header"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          {product.seller?.name && (
            <span
              className="bb-pill"
              data-testid="product-details-vendor-badge"
            >
              {product.seller.name}
            </span>
          )}
          <h1
            className="heading-lg text-primary"
            data-testid="product-title"
          >
            {product.title}
          </h1>
          {product.subtitle && (
            <p
              className="text-md text-secondary"
              data-testid="product-subtitle"
            >
              {product.subtitle}
            </p>
          )}
          <div
            className="flex items-center gap-2"
            data-testid="product-price-container"
          >
            {hasAnyPrice && variantPrice ? (
              <>
                <span
                  className="text-[28px] font-medium text-primary md:text-[34px]"
                  data-testid="product-price-current"
                >
                  {variantPrice.calculated_price}
                </span>
                {variantPrice.calculated_price_number !== variantPrice.original_price_number && (
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
          <WishlistButton
            productId={product.id}
            wishlist={wishlist}
            user={user}
          />
        </div>
      </div>
      {/* v1.12.0 chrome fix: only render the muted variant card when there are
          real variant options. Single-variant voucher products (synthetic
          "Default" only) previously left an empty rounded card above the CTA. */}
      {hasAnyPrice && hasVisibleVariantOptions(product) && (
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
          disabled={isAddToCartDisabled || isAddingItem}
          className="flex w-full justify-center rounded-full bg-[var(--cta)] py-4 text-white hover:bg-[var(--cta-hover)] md:flex-1"
          size="large"
          data-testid="product-add-to-cart-button"
        >
          {isAddingItem ? (
            <DotTrio label={t('adding_to_cart')} />
          ) : !hasAnyPrice || !variantHasPrice ? (
            t('not_available_in_region')
          ) : variantStock && variantHasPrice ? (
            t('add_to_cart')
          ) : (
            t('out_of_stock')
          )}
        </Button>

        {user && product.seller && (
          <Chat
            user={user}
            seller={product.seller}
            buttonClassNames="w-full rounded-full bg-[var(--bb-text-tint-10)] text-primary hover:bg-[var(--bb-text-tint-10)] md:w-auto"
            product={product}
          />
        )}
      </div>
      <GiftModeToggle data-testid="pdp-gift-mode-toggle" />
    </div>
  );
};
