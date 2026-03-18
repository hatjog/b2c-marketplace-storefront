import { getTranslations } from 'next-intl/server';

import { SellerInfo } from '@/components/molecules';
import type { SellerProps } from '@/types/seller';

export const ProductDetailsSeller = async ({ seller }: { seller?: SellerProps }) => {
  if (!seller) return null;

  const t = await getTranslations('products');

  const hasAddress = seller.city || seller.address_line;
  const hasContact = seller.phone || seller.email;

  return (
    <div className="rounded-sm border">
      <div>
        <div className="flex justify-between">
          <SellerInfo
            seller={seller}
            showArrow
            bottomBorder
          />
        </div>
      </div>
      {(hasAddress || hasContact) && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {hasAddress && (
            <p className="label-md text-secondary">
              {t('seller_address')}: {[seller.city, seller.address_line].filter(Boolean).join(' · ')}
            </p>
          )}
          {seller.phone && (
            <p className="label-md text-secondary">
              {t('seller_phone')}: <a href={`tel:${seller.phone}`}>{seller.phone}</a>
            </p>
          )}
          {seller.email && (
            <p className="label-md text-secondary">
              {t('seller_contact')}: {seller.email}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
