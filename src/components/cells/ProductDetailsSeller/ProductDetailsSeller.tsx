import { getTranslations } from 'next-intl/server';

import { SellerInfo } from '@/components/molecules';
import type { SellerProps } from '@/types/seller';

export const ProductDetailsSeller = async ({ seller }: { seller?: SellerProps }) => {
  if (!seller) return null;

  const t = await getTranslations('products');
  const sellerPhone = seller.phone?.trim() || null;
  const sellerEmail = seller.email?.trim() || null;

  const hasAddress = seller.city || seller.address_line;
  const hasContact = sellerPhone || sellerEmail;

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
          {sellerPhone && (
            <p className="label-md text-secondary">
              {t('seller_phone')}: <a href={`tel:${sellerPhone.replace(/\s/g, '')}`}>{sellerPhone}</a>
            </p>
          )}
          {sellerEmail && (
            <p className="label-md text-secondary">
              {t('seller_email')}: {sellerEmail}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
