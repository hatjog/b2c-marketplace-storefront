'use client';

import { useParams } from 'next/navigation';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { primeCategories } from '@/data/categories';
import { cn } from '@/lib/utils';

export const PrimeCategoryNavbar = () => {
  const { category } = useParams();

  return (
    <div className="flex items-center gap-2">
      {Object.keys(primeCategories).map((key: string) => (
        <LocalizedClientLink
          key={key}
          href={`/${key}`}
          className={cn(
            'label-lg px-2 pb-1 uppercase',
            key === category && 'border-b border-primary'
          )}
        >
          {primeCategories[key as keyof typeof primeCategories]}
        </LocalizedClientLink>
      ))}
    </div>
  );
};
