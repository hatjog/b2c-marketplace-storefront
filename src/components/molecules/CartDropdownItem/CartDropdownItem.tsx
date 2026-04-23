import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';

import {
  resolveStorefrontImageSrc,
  STOREFRONT_PLACEHOLDER_IMAGE_SRC,
} from '@/lib/helpers/asset-reference';
import { getMarketId } from '@/lib/helpers/market-filter';
import { convertToLocale } from '@/lib/helpers/money';

export const CartDropdownItem = ({
  item,
  currency_code
}: {
  item: HttpTypes.StoreCartLineItem;
  currency_code: string;
}) => {
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
