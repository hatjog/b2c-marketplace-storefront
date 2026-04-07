import { getTranslations } from 'next-intl/server';

import { SellerInfo } from '@/components/molecules';
import type { SellerProps } from '@/types/seller';

export const ProductDetailsSeller = async ({ seller }: { seller?: SellerProps }) => {
  if (!seller) return null;

  const t = await getTranslations('products');
  const sellerPhone = seller.phone?.trim() || null;
  const sellerEmail = seller.email?.trim() || null;
  const reviews = Array.isArray(seller.reviews) ? seller.reviews.filter(Boolean) : [];
  const reviewCount = reviews.length;
  const rating = reviewCount
    ? reviews.reduce((sum, review) => sum + Number(review?.rating ?? 0), 0) / reviewCount
    : null;

  const hasAddress = seller.city || seller.address_line;
  const hasContact = sellerPhone || sellerEmail;

  return (
    <div className="bb-section-shell space-y-4">
      <div className="flex justify-between">
        <SellerInfo seller={seller} header showArrow bottomBorder />
      </div>
      {(rating != null || hasAddress || hasContact) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rating != null && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_reviews')}</p>
              <p className="heading-sm text-primary">
                {rating.toFixed(1)} · {t('reviews_count', { count: reviewCount })}
              </p>
            </div>
          )}
          {hasAddress && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_address')}</p>
              <p className="label-md text-primary">{[seller.city, seller.address_line].filter(Boolean).join(' · ')}</p>
            </div>
          )}
          {hasContact && (
            <div className="bb-card-muted space-y-1 sm:col-span-2">
              <p className="label-sm text-secondary">{t('seller_contact')}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {sellerPhone && (
                  <p className="label-md text-primary">
                    {t('seller_phone')}: <a href={`tel:${sellerPhone.replace(/\s/g, '')}`}>{sellerPhone}</a>
                  </p>
                )}
                {sellerEmail && (
                  <p className="label-md text-primary">
                    {t('seller_email')}: {sellerEmail}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
