import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

const CATEGORY_IMAGE_HANDLES = new Set([
  'accessories',
  'boots',
  'sandals',
  'shirt',
  'sneakers',
  'sport',
]);

export function CategoryCard({
  category,
}: {
  category: { name: string; handle: string; metadata?: { photo_url?: string } };
}) {
  const imageSrc = category.metadata?.photo_url
    ?? (CATEGORY_IMAGE_HANDLES.has(category.handle)
        ? `/images/categories/${category.handle}.png`
        : '/images/placeholder.svg');

  return (
    <LocalizedClientLink
      href={`/categories/${category.handle}`}
      className="relative flex aspect-square w-[233px] flex-col items-center rounded-sm border bg-component transition-all hover:rounded-full"
      data-testid="category-item"
    >
      <div className="relative flex aspect-square w-[200px] overflow-hidden">
        <Image
          loading="lazy"
          src={imageSrc}
          alt={`category - ${category.name}`}
          width={200}
          height={200}
          sizes="(min-width: 1024px) 200px, 40vw"
          className="scale-90 rounded-full object-contain"
        />
      </div>
      <h3 className="label-lg w-full text-center text-primary">{category.name}</h3>
    </LocalizedClientLink>
  );
}
