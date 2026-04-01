'use client';

import { useTranslations } from 'next-intl';

import { StarRating } from '@/components/atoms';

export const SellerScore = ({ rate, reviewCount }: { rate: number; reviewCount: number }) => {
  const t = useTranslations('products');

  return (
    <div className="label-md flex h-full flex-col items-center py-12">
      <h3 className="heading-sm mb-2 uppercase">{t('seller_score')}</h3>
      <div className="mb-4 flex items-center gap-2 text-secondary">
        <StarRating
          rate={rate}
          starSize={16}
        />{' '}
        {rate.toFixed(1)}
      </div>
      <p className="text-secondary">{t('reviews_count', { count: reviewCount })}</p>
    </div>
  );
};
