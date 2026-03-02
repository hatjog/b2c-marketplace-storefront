import { BannerBlock } from './BannerBlock';
import { BlogSectionBlock } from './BlogSectionBlock';
import { CategoriesGridBlock } from './CategoriesGridBlock';
import { HeroBlock } from './HeroBlock';
import { isSectionObject, type RawSection } from './homepage-utils';
import { ProductsCarouselBlock } from './ProductsCarouselBlock';
import { StyleSectionBlock } from './StyleSectionBlock';

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
                section={section}
              />
            );
          case 'products_carousel':
            return (
              <ProductsCarouselBlock
                key={key}
                section={section}
                locale={locale}
              />
            );
          case 'categories_grid':
            return (
              <CategoriesGridBlock
                key={key}
                section={section}
              />
            );
          case 'banner':
            return (
              <BannerBlock
                key={key}
                section={section}
              />
            );
          case 'style_section':
            return (
              <StyleSectionBlock
                key={key}
                section={section}
              />
            );
          case 'blog_section':
            return (
              <BlogSectionBlock
                key={key}
                section={section}
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
