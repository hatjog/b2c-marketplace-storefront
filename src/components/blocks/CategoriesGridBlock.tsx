import { HomeCategories } from '@/components/sections';
import { fetchHomepageCategories } from '@/lib/homepage/dynamic-blocks';

import { resolveBooleanFlag } from './homepage-utils';

export type CategoriesGridSectionBlock = {
  heading?: string | null;
  limit?: number | null;
  hide_empty?: boolean | null;
};

export async function CategoriesGridBlock({ section }: { section: CategoriesGridSectionBlock }) {
  const hideEmpty = resolveBooleanFlag(section.hide_empty, false);
  const categories = await fetchHomepageCategories({
    limit: section.limit,
    hideEmpty,
  });

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <HomeCategories
        heading={section.heading ?? 'SHOP BY CATEGORY'}
        categories={categories}
      />
    </div>
  );
}
