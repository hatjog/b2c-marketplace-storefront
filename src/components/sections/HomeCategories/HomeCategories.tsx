import { Carousel } from '@/components/cells';
import { CategoryCard } from '@/components/organisms';

type HomeCategory = { name: string; handle: string; id?: number };

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
  const categoriesToRender = sectionCategories?.length ? sectionCategories : categories;

  return (
    <section
      className="w-full bg-primary py-8"
      data-testid="categories-grid"
    >
      <div className="mb-6">
        <h2 className="heading-lg uppercase text-primary">{heading}</h2>
      </div>
      <Carousel
        items={categoriesToRender.map((category, index) => (
          <CategoryCard
            key={`${category.id ?? category.handle}-${index}`}
            category={category}
          />
        ))}
      />
    </section>
  );
};
