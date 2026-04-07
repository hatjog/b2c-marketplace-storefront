import { getTranslations } from 'next-intl/server';

import { SellerReviewList, SellerScore } from '@/components/molecules';
import { getSellerByHandle } from '@/lib/data/seller';

export const SellerReviewTab = async ({ seller_handle }: { seller_handle: string }) => {
  const t = await getTranslations('products');
  const seller = await getSellerByHandle(seller_handle);

  if (!seller) return null;

  const filteredReviews = seller.reviews;

  const reviewCount = filteredReviews ? filteredReviews.length : 0;

  const rating =
    filteredReviews && filteredReviews.length > 0
      ? filteredReviews.reduce((sum, r) => sum + r?.rating, 0) / filteredReviews.length
      : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="bb-section-shell bb-section-shell-strong">
        <SellerScore
          rate={rating}
          reviewCount={reviewCount}
        />
      </div>
      <div className="bb-section-shell">
        <h3 className="heading-sm border-b border-[rgba(144,112,50,0.14)] pb-4 uppercase">{t('seller_reviews')}</h3>
        <SellerReviewList reviews={seller.reviews} />
      </div>
    </div>
  );
};
