'use client';

import { ActiveFilterElement } from '@/components/cells';
import useGetAllSearchParams from '@/hooks/useGetAllSearchParams';

export const ProductListingActiveFilters = () => {
  const { allSearchParams } = useGetAllSearchParams();
  const filters = Object.entries(allSearchParams).filter(
    element =>
      element[0] !== 'sortBy' &&
      element[0] !== 'page' &&
      element[0] !== 'sold' &&
      element[0] !== 'products[page]'
  );

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="no-scrollbar flex flex-wrap gap-2 overflow-x-auto">
      {filters.map(filter => (
        <ActiveFilterElement
          key={filter[0]}
          filter={filter}
        />
      ))}
    </div>
  );
};
