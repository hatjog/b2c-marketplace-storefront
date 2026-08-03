'use client';

import { useTranslations } from 'next-intl';

import { StarRating } from '@/components/atoms';
import { Accordion, FilterCheckboxOption } from '@/components/molecules';
import useFilters from '@/hooks/useFilters';

const RATING_OPTIONS = ['5', '4', '3', '2', '1'];

type SellerRatingFilterProps = {
  heading?: string;
};

export const SellerRatingFilter = ({ heading }: SellerRatingFilterProps) => {
  const t = useTranslations('filters');
  const { updateFilters, isFilterActive } = useFilters('seller_rating');

  return (
    <Accordion heading={heading || t('seller_rating')}>
      <ul className="px-4">
        {RATING_OPTIONS.map(rating => (
          <li
            key={rating}
            className="mb-4 flex cursor-pointer items-center gap-2"
          >
            <FilterCheckboxOption
              checked={isFilterActive(rating)}
              onCheck={() => updateFilters(rating)}
              label={rating}
            />
            <StarRating rate={+rating} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-2 px-4">{t('rating_disclaimer')}</p>
    </Accordion>
  );
};
