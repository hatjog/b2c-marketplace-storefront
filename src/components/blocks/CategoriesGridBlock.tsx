import { HomeCategories } from '@/components/sections';
import { fetchHomepageCategories } from '@/lib/homepage/dynamic-blocks';

export type CategoriesGridSectionBlock = {
  heading?: string | null;
  limit?: number | null;
};

export async function CategoriesGridBlock({ section }: { section: CategoriesGridSectionBlock }) {
  const categories = await fetchHomepageCategories({
    limit: section.limit
  });

  return (
    <div className="w-full px-4 lg:px-8">
      <HomeCategories
        heading={section.heading ?? 'SHOP BY CATEGORY'}
        categories={categories}
      />
    </div>
  );
}
