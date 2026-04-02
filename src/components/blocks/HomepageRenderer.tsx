import { BannerBlock } from './BannerBlock';
import { BlogSectionBlock } from './BlogSectionBlock';
import { CategoriesGridBlock } from './CategoriesGridBlock';
import { HeroBlock } from './HeroBlock';
import {
  isSectionObject,
  type BannerSectionBlock,
  type RawSection,
  type StyleSectionBlock as HomepageStyleSectionBlock,
} from './homepage-utils';
import {
  ProductsCarouselBlock,
  type ProductsCarouselSectionBlock,
} from './ProductsCarouselBlock';
import type { CategoriesGridSectionBlock } from './CategoriesGridBlock';
import type { HeroSectionBlock } from './HeroBlock';
import { StyleSectionBlock } from './StyleSectionBlock';
import type { BlogSectionSectionBlock } from './BlogSectionBlock';

export function HomepageRenderer({
  sections,
  locale
}: {
  sections?: unknown[] | null;
  locale: string;
}) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  const enabledSections = sections.filter(
    (section): section is RawSection => isSectionObject(section) && section.enabled === true
  );

  if (enabledSections.length === 0) {
    return null;
  }

  return (
    <>
      {enabledSections.map((section, index) => {
        const key = section.id ?? `${section.blockType ?? 'unknown'}-${index}`;

        switch (section.blockType) {
          case 'hero':
            return (
              <HeroBlock
                key={key}
                section={section as HeroSectionBlock}
              />
            );
          case 'products_carousel':
            return (
              <ProductsCarouselBlock
                key={key}
                section={section as ProductsCarouselSectionBlock}
                locale={locale}
              />
            );
          case 'categories_grid':
            return (
              <CategoriesGridBlock
                key={key}
                section={section as CategoriesGridSectionBlock}
              />
            );
          case 'banner':
            return (
              <BannerBlock
                key={key}
                section={section as BannerSectionBlock}
              />
            );
          case 'style_section':
            return (
              <StyleSectionBlock
                key={key}
                section={section as HomepageStyleSectionBlock}
              />
            );
          case 'blog_section':
            return (
              <BlogSectionBlock
                key={key}
                section={section as BlogSectionSectionBlock}
              />
            );
          default:
            console.error(
              `[homepage] unknown blockType "${section.blockType ?? 'undefined'}"`,
              section
            );
            return null;
        }
      })}
    </>
  );
}
