'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

const _selectOptions = [
  { label: 'Newest', value: 'created_at' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' }
];

export const ProductListingHeader = ({ total }: { total: number }) => {
  const t = useTranslations('navigation');
  const router = useRouter();
  const pathname = usePathname();

  const _selectOptionHandler = (value: string) => {
    router.push(`${pathname}?sortBy=${value}`);
  };

  return (
    <div
      className="flex w-full items-center justify-between"
      data-testid="product-listing-header"
    >
      <div data-testid="product-listing-total">{t('listings_count', { count: total })}</div>
      {/* <div className='hidden md:flex gap-2 items-center'>
        Sort by:{' '}
        <SelectField
          className='min-w-[200px]'
          options={selectOptions}
          selectOption={selectOptionHandler}
          data-testid="product-listing-sort-dropdown"
        />
      </div> */}
    </div>
  );
};
