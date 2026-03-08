'use client';

import { useMemo } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { getActiveParentHandle } from '@/lib/helpers/category-utils';
import { cn } from '@/lib/utils';

interface ParentCategoryLinksProps {
  parentCategories: HttpTypes.StoreProductCategory[];
  categories: HttpTypes.StoreProductCategory[];
}

export const ParentCategoryLinks = ({ parentCategories, categories }: ParentCategoryLinksProps) => {
  const t = useTranslations('navigation');
  const { category } = useParams<{ category?: string }>();

  const activeParentHandle = useMemo(
    () => getActiveParentHandle(category, categories, parentCategories),
    [category, categories, parentCategories]
  );

  return (
    <nav
      className="hidden items-center gap-4 lg:flex"
      aria-label={t('parent_categories_aria')}
    >
      {parentCategories.map(({ id, handle, name }) => {
        const isActive = handle === activeParentHandle;

        return (
          <LocalizedClientLink
            key={id}
            href={`/categories/${handle}`}
            className={cn(
              'label-large pb-2 font-semibold uppercase text-primary transition-opacity hover:opacity-80',
              isActive && 'border-b border-primary'
            )}
          >
            {name}
          </LocalizedClientLink>
        );
      })}
    </nav>
  );
};
