import { getTranslations } from 'next-intl/server';

import { CategoryCard } from '@/components/organisms';

type HomeCategory = { name: string; handle: string; id?: number; metadata?: { photo_url?: string } };

export const categories: { id: number; name: string; handle: string }[] = [
  {
    id: 1,
    name: 'Sneakers',
    handle: 'sneakers'
  },
  {
    id: 2,
    name: 'Sandals',
    handle: 'sandals'
  },
  {
    id: 3,
    name: 'Boots',
    handle: 'boots'
  },
  {
    id: 4,
    name: 'Sport',
    handle: 'sport'
  },
  {
    id: 5,
    name: 'Accessories',
    handle: 'accessories'
  }
];

export const HomeCategories = async ({
  heading,
  categories: sectionCategories
}: {
  heading: string;
  categories?: HomeCategory[];
}) => {
  const t = await getTranslations('homepage');
  const categoriesToRender = sectionCategories?.length ? sectionCategories : categories;

  return (
    <section
      className="bb-section-shell bb-section-shell-strong"
      data-testid="categories-grid"
    >
      <div className="mb-8 space-y-2">
        <p className="bb-eyebrow">{t('categories_eyebrow')}</p>
        <h2 className="heading-lg text-primary">{heading}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {categoriesToRender.map((category, index) => (
          <CategoryCard
            key={`${category.id ?? category.handle}-${index}`}
            category={category}
          />
        ))}
      </div>
    </section>
  );
};
