import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { SellerReview } from '@/components/molecules';
import type { SingleProductReview } from '@/types/product';

export const ProductDetailsSellerReviews = ({ reviews }: { reviews: SingleProductReview[] }) => {
  const t = useTranslations('products');

  return (
    <div
      className="rounded-[var(--bb-radius-card)] border p-4"
      data-testid="product-seller-reviews-section"
    >
      <div className="mb-5 flex items-center justify-between">
        <h4 className="heading-sm uppercase">{t('seller_reviews')}</h4>
        <Button
          variant="tonal"
          className="label-md font-400 uppercase"
          data-testid="product-seller-reviews-see-more"
        >
          {t('see_more')}
        </Button>
      </div>
      {reviews.map(review => (
        <SellerReview
          key={review.id}
          review={review}
          data-testid={`product-seller-review-${review.id}`}
        />
      ))}
    </div>
  );
};
