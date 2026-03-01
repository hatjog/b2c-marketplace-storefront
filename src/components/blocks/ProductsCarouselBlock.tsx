import { HomeProductSection } from '@/components/sections';
import { fetchHomepageProducts } from '@/lib/homepage/dynamic-blocks';

export type ProductsCarouselSectionBlock = {
  heading?: string | null;
  sort?: 'newest' | 'price_asc' | 'price_desc' | null;
  limit?: number | null;
};

export async function ProductsCarouselBlock({
  section,
  locale
}: {
  section: ProductsCarouselSectionBlock;
  locale: string;
}) {
  const resolvedLimit = Math.max(1, Math.min(section.limit ?? 4, 24));

  const products = await fetchHomepageProducts({
    locale,
    sort: section.sort,
    limit: resolvedLimit
  });

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="w-full px-4 lg:px-8">
      <HomeProductSection
        heading={section.heading ?? 'trending listings'}
        locale={locale}
        products={products}
        home
        maxItems={resolvedLimit}
      />
    </div>
  );
}
