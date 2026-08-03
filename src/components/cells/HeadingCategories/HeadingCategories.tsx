'use client';

import type { HttpTypes } from '@medusajs/types';
import { useParams } from 'next/navigation';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { cn } from '@/lib/utils';

export const HeadingCategories = ({
  categories
}: {
  categories: HttpTypes.StoreProductCategory[];
}) => {
  const { category } = useParams();

  return (
    <nav className="hidden flex-col items-center space-x-2 md:flex-row lg:flex">
      {categories?.map(({ id, handle, name }) => (
        <LocalizedClientLink
          key={id}
          href={`/categories/${handle}`}
          className={cn(
            'label-md mb-4 px-2 uppercase md:mb-0',
            handle === category && 'border-b border-primary'
          )}
        >
          {name}
        </LocalizedClientLink>
      ))}
    </nav>
  );
};
