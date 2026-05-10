/**
 * CategoriesGridBlock — v1.7.0 Story 2.2 update.
 *
 * Changes:
 *   - Hardcoded "SHOP BY CATEGORY" fallback replaced with i18n key
 *     (navigation.all_products) so the section heading is locale-aware.
 */
import { getTranslations } from 'next-intl/server';

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

  const t = await getTranslations('category');
  // Use CMS-provided heading when available, fall back to i18n key (not hardcoded string)
  const heading = section.heading ?? t('breadcrumb_all');

  return (
    <div className="w-full">
      <HomeCategories
        heading={heading}
        categories={categories}
      />
    </div>
  );
}
