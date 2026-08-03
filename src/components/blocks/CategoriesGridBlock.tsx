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
  const resolvedLimit = Math.max(6, Math.min(section.limit ?? 8, 8));
  const categories = await fetchHomepageCategories({
    limit: resolvedLimit,
    hideEmpty,
  });

  const t = await getTranslations('category');
  // Use CMS-provided heading when available, fall back to i18n key (not hardcoded string).
  // v1.7.0 Story 2.2 re-review fix (LOW L2'): previously fell back to
  // `category.breadcrumb_all` ("Wszystkie kategorie") which is a breadcrumb
  // label, not a section heading. Now uses `category.section_heading`
  // ("Przeglądaj kategorie" / "Browse categories"), purpose-built for this slot.
  const heading = section.heading ?? t('section_heading');

  return (
    <div className="w-full">
      <HomeCategories
        heading={heading}
        categories={categories}
      />
    </div>
  );
}
