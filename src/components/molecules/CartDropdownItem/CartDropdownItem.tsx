import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import {
  resolveStorefrontImageSrc,
  STOREFRONT_PLACEHOLDER_IMAGE_SRC,
} from '@/lib/helpers/asset-reference';
import { readSelectedSeller } from '@/lib/helpers/cart-vendor-context';
import { getMarketId } from '@/lib/helpers/market-filter';
import { convertToLocale } from '@/lib/helpers/money';
import { isMultiVendorEnabled } from '@/lib/flags/multiVendorPricing';

/**
 * Story 5.5 — multi-vendor pricing flag re-used (Story 5.1/5.2 pattern).
 * Mini-cart line item seller label render gated. Default OFF → legacy
 * cart dropdown unchanged.
 */
const MULTI_VENDOR_PRICING_ENABLED = isMultiVendorEnabled();

export const CartDropdownItem = ({
  item,
  currency_code
}: {
  item: HttpTypes.StoreCartLineItem;
  currency_code: string;
}) => {
  const t = useTranslations('seller.cart');
  // Story 5.5 — flag-gated; null gdy single-vendor flow.
  const selectedSeller = MULTI_VENDOR_PRICING_ENABLED ? readSelectedSeller(item) : null;
  const _original_total = convertToLocale({
    amount: (item.compare_at_unit_price || 0) * item.quantity,
    currency_code
  });

  const total = convertToLocale({
    amount: item.subtotal ?? 0,
    currency_code
  });
  const thumbnailSrc = resolveStorefrontImageSrc(item.thumbnail, getMarketId());
  const usesPlaceholderImage = thumbnailSrc === STOREFRONT_PLACEHOLDER_IMAGE_SRC;

  return (
    <div className="mb-4 flex gap-2 rounded-sm border p-1">
      <div className="flex h-[132px] w-[100px] items-center justify-center">
        {!usesPlaceholderImage ? (
          <Image
            src={thumbnailSrc}
            alt={item.product_title || 'Product thumbnail'}
            width={80}
            height={90}
            className="h-[90px] w-[80px] rounded-xs object-cover"
            priority
          />
        ) : (
          <Image
            src={STOREFRONT_PLACEHOLDER_IMAGE_SRC}
            alt="Product thumbnail"
            width={50}
            height={66}
            className="h-[66px] w-[50px] rounded-xs object-contain opacity-30"
          />
        )}
      </div>

      <div className="py-2">
        <h4 className="heading-xs">{item.product_title}</h4>
        {selectedSeller && (
          <p
            className="text-xs text-secondary"
            aria-label={t('line_item_seller_label')}
            data-testid={`cart-line-item-seller-${item.id}`}
          >
            {t('from_seller', { seller_name: selectedSeller.name })}
          </p>
        )}
        <div className="label-md text-secondary">
          {item.variant?.options?.map(({ option, id, value }) => (
            <p key={id}>
              {option?.title}: <span className="text-primary">{value}</span>
            </p>
          ))}
          <p>
            Quantity: <span className="text-primary">{item.quantity}</span>
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 pt-2 lg:mt-0">
          <p className="label-lg">{total}</p>
        </div>
      </div>
    </div>
  );
};
