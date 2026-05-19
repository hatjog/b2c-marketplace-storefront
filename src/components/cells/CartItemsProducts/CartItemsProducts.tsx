import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { DeleteCartItemButton } from '@/components/molecules';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { UpdateCartItemButton } from '@/components/molecules/UpdateCartItemButton/UpdateCartItemButton';
import {
  resolveStorefrontImageSrc,
  STOREFRONT_PLACEHOLDER_IMAGE_SRC,
} from '@/lib/helpers/asset-reference';
import { readSelectedSeller } from '@/lib/helpers/cart-vendor-context';
import { filterValidCartItems } from '@/lib/helpers/filter-valid-cart-items';
import { getMarketId } from '@/lib/helpers/market-filter';
import { convertToLocale } from '@/lib/helpers/money';
import { getCurrentFlagValue } from '@/lib/security/flagAtomicCheck';

/**
 * Story 5.5 — multi-vendor pricing flag re-used (Story 5.1/5.2 pattern).
 * Seller label render gated; persistence path NIE gated. Default OFF →
 * legacy single-vendor cart UI unchanged. Flag flip ON → seller labels
 * surface retroactively dla items z istniejącym metadata.
 *
 * cleanup-12f: flag check moved inside component body (lazy eval) to avoid
 * Turbopack module-evaluation order issue with barrel imports.
 *
 * TF-75 (cleanup-32 synthesis): single helper `getCurrentFlagValue()` from
 * `@/lib/security/flagAtomicCheck` invoked at render-time (preserves
 * cleanup-12f TDZ-safe body-scoped pattern).
 */

export const CartItemsProducts = ({
  products,
  currency_code,
  delete_item = true,
  change_quantity = true
}: {
  products: HttpTypes.StoreCartLineItem[];
  currency_code: string;
  delete_item?: boolean;
  change_quantity?: boolean;
}) => {
  // Filter out items with invalid data (missing prices/variants)
  const validProducts = filterValidCartItems(products);
  const t = useTranslations('seller.cart');
  const tCart = useTranslations('cart');
  // cleanup-12f + TF-75: evaluate flag inside component body via single helper.
  const mvEnabled = getCurrentFlagValue();

  return (
    <div>
      {validProducts.map(product => {
        const { options } = product.variant ?? {};
        const thumbnailSrc = resolveStorefrontImageSrc(product.thumbnail, getMarketId());
        const usesPlaceholderImage = thumbnailSrc === STOREFRONT_PLACEHOLDER_IMAGE_SRC;

        const total = convertToLocale({
          amount: product.subtotal ?? 0,
          currency_code
        });

        // Story 5.5 — multi-vendor seller label (flag-gated; null when
        // legacy single-vendor flow → label not rendered → zero regression).
        const selectedSeller = mvEnabled
          ? readSelectedSeller(product)
          : null;

        return (
          <div
            key={product.id}
            data-testid={`cart-item-${product.id}`}
            className="flex gap-2 rounded-sm border p-1"
          >
            <LocalizedClientLink href={`/products/${product.product_handle}`}>
              <div
                className="flex h-[132px] w-[100px] items-center justify-center"
                data-testid="cart-item-image"
              >
                {!usesPlaceholderImage ? (
                  <Image
                    src={thumbnailSrc}
                    alt={tCart('thumbnail_alt')}
                    width={100}
                    height={132}
                    className="h-[132px] w-[100px] rounded-xs object-contain"
                  />
                ) : (
                  <Image
                    src={STOREFRONT_PLACEHOLDER_IMAGE_SRC}
                    alt={tCart('thumbnail_alt')}
                    width={50}
                    height={66}
                    className="h-[66px] w-[50px] rounded-xs object-contain opacity-30"
                  />
                )}
              </div>
            </LocalizedClientLink>

            <div className="w-full p-2">
              <div className="flex justify-between lg:mb-4">
                <LocalizedClientLink href={`/products/${product.product_handle}`}>
                  <div className="mb-4 w-[100px] md:w-[200px] lg:mb-0 lg:w-[280px]">
                    <h3
                      className="heading-xs truncate uppercase"
                      data-testid="cart-item-title"
                    >
                      {product.product_title}
                      {product.subtitle && ` - ${product.subtitle}`}
                    </h3>
                    {selectedSeller && (
                      <p
                        className="text-xs text-secondary"
                        aria-label={t('line_item_seller_label')}
                        data-testid={`cart-line-item-seller-${product.id}`}
                      >
                        {t('from_seller', { seller_name: selectedSeller.name })}
                      </p>
                    )}
                  </div>
                </LocalizedClientLink>
                {delete_item && (
                  <div className="lg:flex">
                    <DeleteCartItemButton id={product.id} />
                  </div>
                )}
              </div>
              <div className="-mt-4 justify-between lg:mt-0 lg:flex">
                <div
                  className="label-md text-secondary"
                  data-testid="cart-item-details"
                >
                  {options?.map(({ option, id, value }) => (
                    <p key={id}>
                      {option?.title}: <span className="text-primary">{value}</span>
                    </p>
                  ))}
                  {change_quantity ? (
                    <UpdateCartItemButton
                      quantity={product.quantity}
                      lineItemId={product.id}
                    />
                  ) : (
                    <p>
                      {tCart('quantity_label')}: <span className="text-primary">{product.quantity}</span>
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2 lg:mt-0 lg:block lg:text-right">
                  <p
                    className="label-lg"
                    data-testid="cart-item-price"
                  >
                    {total}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
