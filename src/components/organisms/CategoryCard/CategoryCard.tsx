'use client';

import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { resolveCategoryImage } from '@/lib/category-images';

export function CategoryCard({
  category,
}: {
  category: { name: string; handle: string; metadata?: Record<string, unknown> | null };
}) {
  const { src: imageSrc } = resolveCategoryImage(category.handle, category.metadata);

  return (
    <LocalizedClientLink
      href={`/categories/${category.handle}`}
      className="group relative flex min-h-[320px] overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-white-75)] shadow-[0_16px_40px_rgba(90,67,28,0.08)] transition-transform duration-300 hover:-translate-y-1"
      data-testid="category-item"
    >
      <div className="absolute inset-0">
        {/* Decorative background: the adjacent <h3> already names the category, so a
            name-repeating alt triggers axe image-redundant-alt. Empty alt = decorative. */}
        <Image
          loading="lazy"
          src={imageSrc}
          alt=""
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
      </div>
      <div className="relative mt-auto flex w-full items-end justify-between gap-3 p-5 text-white">
        <h3 className="heading-md max-w-[12ch]">{category.name}</h3>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/10 text-xl backdrop-blur transition-colors duration-300 group-hover:bg-white group-hover:text-primary">
          +
        </span>
      </div>
    </LocalizedClientLink>
  );
}
