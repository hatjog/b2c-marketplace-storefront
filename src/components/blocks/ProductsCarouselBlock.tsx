import { HomeProductSection } from '@/components/sections';
import { fetchHomepageProducts } from '@/lib/homepage/dynamic-blocks';

import { resolveBooleanFlag } from './homepage-utils';

export type ProductsCarouselSectionBlock = {
  heading?: string | null;
  sort?: 'newest' | 'price_asc' | 'price_desc' | null;
  limit?: number | null;
  show_price?: boolean | null;
  show_vendor?: boolean | null;
};

export async function ProductsCarouselBlock({
  section,
  locale
}: {
  section: ProductsCarouselSectionBlock;
  locale: string;
}) {
  const resolvedLimit = Math.max(1, Math.min(section.limit ?? 4, 24));
  const showPrice = resolveBooleanFlag(section.show_price, true);
  const showVendor = resolveBooleanFlag(section.show_vendor, true);

  const products = await fetchHomepageProducts({
    locale,
    sort: section.sort,
    limit: resolvedLimit
  });

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <HomeProductSection
        heading={section.heading ?? 'trending listings'}
        locale={locale}
        products={products}
        home
        maxItems={resolvedLimit}
        showPrice={showPrice}
        showVendor={showVendor}
      />
    </div>
  );
}
