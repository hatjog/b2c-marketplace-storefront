import { getTranslations } from 'next-intl/server';

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
  const t = await getTranslations({ locale, namespace: 'home_v3' });
  const resolvedLimit = Math.max(1, Math.min(section.limit ?? 4, 24));
  const showPrice = resolveBooleanFlag(section.show_price, true);
  const showVendor = resolveBooleanFlag(section.show_vendor, true);

  const products = await fetchHomepageProducts({
    locale,
    sort: section.sort,
    limit: resolvedLimit
  });

  const resolvedHeading = section.heading ?? t('editorial_choice.heading');

  if (products.length === 0) {
    return (
      <section
        className="bb-section-shell w-full"
        data-testid="products-carousel-empty"
      >
        <div className="mb-8 space-y-2">
          <p className="bb-eyebrow">{t('editorial_choice.eyebrow')}</p>
          <h2 className="heading-lg tracking-tight">{resolvedHeading}</h2>
        </div>
        <p className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-5 text-sm text-secondary">
          {t('editorial_choice.empty_state')}
        </p>
      </section>
    );
  }

  return (
    <div className="w-full">
      <HomeProductSection
        heading={resolvedHeading}
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
