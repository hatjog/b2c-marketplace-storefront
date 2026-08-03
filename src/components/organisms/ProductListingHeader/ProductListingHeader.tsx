'use client';

import { useTranslations } from 'next-intl';

import { SortDropdown } from '@/components/molecules/SortDropdown/SortDropdown';

export const ProductListingHeader = ({ total, showSort = true }: { total: number; showSort?: boolean }) => {
  const t = useTranslations('navigation');

  return (
    <div
      className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      data-testid="product-listing-header"
    >
      <div className="space-y-2">
        <p className="bb-eyebrow">{t('all_products')}</p>
        <div className="heading-lg" data-testid="product-listing-total">{t('listings_count', { count: total })}</div>
      </div>
      {showSort ? <SortDropdown /> : null}
    </div>
  );
};
