import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { SellerFooter, SellerHeading } from '@/components/organisms';
import { SellerContact, SellerHero, SellerSocialLinks } from '@/components/organisms/seller';

export const SellerPageHeader = async ({
  header: _header = false,
  seller,
  user
}: {
  header?: boolean;
  seller: any;
  user: HttpTypes.StoreCustomer | null;
}) => {
  const t = await getTranslations('products');
  const reviews = Array.isArray(seller.reviews)
    ? (seller.reviews.filter(Boolean) as Array<{ rating?: number | null }>)
    : [];
  const reviewCount = reviews.length;
  const rating = reviewCount
    ? reviews.reduce((sum: number, review: { rating?: number | null }) => sum + Number(review?.rating ?? 0), 0) / reviewCount
    : null;
  const locationText = [seller.city, seller.address_line]
    .map((value: string | null | undefined) => value?.trim())
    .filter(Boolean)
    .join(' · ');
  const contactText = [seller.phone, seller.email]
    .map((value: string | null | undefined) => value?.trim())
    .find(Boolean);

  return (
    <div className="bb-section-shell bb-section-shell-strong overflow-hidden">
      <div className="space-y-6">
        <SellerHero name={seller.name} photo={seller.photo || null} />
        <SellerHeading header seller={seller} user={user} />
        <div className="grid gap-3 md:grid-cols-3">
          {rating != null && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_reviews')}</p>
              <p className="heading-sm text-primary">
                {rating.toFixed(1)} · {t('reviews_count', { count: reviewCount })}
              </p>
            </div>
          )}
          {locationText && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_address')}</p>
              <p className="label-md text-primary">{locationText}</p>
            </div>
          )}
          {contactText && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_contact')}</p>
              <p className="label-md text-primary">{contactText}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SellerSocialLinks socialLinks={seller.social_links} />
          <SellerContact phone={seller.phone} email={seller.email} />
        </div>
        <SellerFooter seller={seller} />
      </div>
    </div>
  );
};
