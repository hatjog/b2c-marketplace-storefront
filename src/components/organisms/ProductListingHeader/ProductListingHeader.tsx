'use client';

import { useTranslations } from 'next-intl';

import { SortDropdown } from '@/components/molecules/SortDropdown/SortDropdown';

export const ProductListingHeader = ({ total }: { total: number }) => {
  const t = useTranslations('navigation');

  return (
    <div
      className="flex w-full items-center justify-between"
      data-testid="product-listing-header"
    >
      <div data-testid="product-listing-total">{t('listings_count', { count: total })}</div>
      <SortDropdown />
    </div>
  );
};
