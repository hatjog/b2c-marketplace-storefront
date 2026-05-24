'use client';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Carousel } from '@/components/cells';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { ProductCard } from '@/components/organisms';
import type { Product } from '@/types/product';

type CuratedCategory = {
  id: string;
  name: string;
  handle: string;
};

export function CartRecommendations({
  recommendedProducts,
  curatedCategories
}: {
  recommendedProducts: Array<HttpTypes.StoreProduct | Product>;
  curatedCategories: CuratedCategory[];
}) {
  const t = useTranslations('cart');

  const hasRecommendedProducts = recommendedProducts.length > 0;
  const hasCuratedCategories = curatedCategories.length > 0;

  if (!hasRecommendedProducts && !hasCuratedCategories) {
    return null;
  }

  const items = hasRecommendedProducts
    ? recommendedProducts.map(product => (
        <ProductCard
          key={product.id}
          product={product}
        />
      ))
    : curatedCategories.map(category => (
        <LocalizedClientLink
          key={category.id}
          href={`/categories/${category.handle}`}
          className="group relative flex min-h-[280px] overflow-hidden rounded-[28px] border border-[var(--bb-border-soft)] bg-[var(--bb-white-75)] p-6 shadow-[0_16px_40px_rgba(90,67,28,0.08)] transition-transform duration-300 hover:-translate-y-1"
          data-testid={`cart-recommended-fallback-${category.handle}`}
        >
          <div className="mt-auto flex w-full items-end justify-between gap-3">
            <h3 className="heading-md max-w-[14ch]">{category.name}</h3>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bb-tint-gold-24)] bg-white/70 text-xl text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
              +
            </span>
          </div>
        </LocalizedClientLink>
      ));

  return (
    <section
      className="mt-10"
      aria-label={t('recommended_heading')}
      data-testid="cart-recommended"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="heading-lg">{t('recommended_heading')}</h2>
        {!hasRecommendedProducts && (
          <p className="text-sm text-secondary">{t('recommended_fallback_label')}</p>
        )}
      </div>
      <Carousel
        align="start"
        items={items}
      />
    </section>
  );
}
