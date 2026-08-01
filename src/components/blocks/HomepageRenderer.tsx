import { isSupportedLocale, type SupportedLocale } from '@/i18n/routing';
import { LocaleFallbackFragment } from '@/components/locale/LocaleFallbackFragment';

import { BannerBlock } from './BannerBlock';
import { BlogSectionBlock } from './BlogSectionBlock';
import { CategoriesGridBlock } from './CategoriesGridBlock';
import { EditorialDarkBandBlock } from './EditorialDarkBandBlock';
import { GiftCTACardBlock } from './GiftCTACardBlock';
import { HeroBlock } from './HeroBlock';
import { JournalTeaserBlock } from './JournalTeaserBlock';
import { TrustStripBlock } from './TrustStripBlock';
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

/**
 * QD-01: `normalizeHomepageSections` tags a section whose copy fell back to
 * `market.locales.default`. Reading it here — one place, above every block —
 * keeps the notice and the `lang` attached to exactly the fragment that fell
 * back (party review PR-2), and keeps the blocks free of locale logic.
 */
function readSectionFallback(
  section: RawSection
): { locale: SupportedLocale; whole: boolean; fields: string[] } | null {
  const marker = section.locale_fallback;
  if (typeof marker !== 'object' || marker === null) {
    return null;
  }

  const { locale, whole, fields } = marker as {
    locale?: unknown;
    whole?: unknown;
    fields?: unknown;
  };

  if (typeof locale !== 'string' || !isSupportedLocale(locale)) {
    return null;
  }

  return {
    locale,
    whole: whole === true,
    fields: Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : []
  };
}

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

  const routeLocale = isSupportedLocale(locale) ? locale : null;

  return (
    <>
      {enabledSections.map((section, index) => {
        const key = section.id ?? `${section.blockType ?? 'unknown'}-${index}`;
        const fallback = readSectionFallback(section);
        const rendered = renderSection(section, key, locale);

        if (!rendered || !fallback || !routeLocale) {
          return rendered;
        }

        return (
          <LocaleFallbackFragment
            key={key}
            locale={routeLocale}
            fallbackLocale={fallback.locale}
            whole={fallback.whole}
            fields={fallback.fields}
          >
            {rendered}
          </LocaleFallbackFragment>
        );
      })}
    </>
  );
}

function renderSection(section: RawSection, key: string | number, locale: string) {
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
          // v1.8.0 W1-01 home v3 editorial blocks (Story 3.0)
          case 'editorial_dark_band':
            return (
              <EditorialDarkBandBlock
                key={key}
                locale={locale}
                heading={(section as { heading?: string }).heading}
                subheading={(section as { subheading?: string }).subheading}
                vibes={(section as { vibes?: Parameters<typeof EditorialDarkBandBlock>[0]['vibes'] }).vibes}
              />
            );
          case 'gift_cta_card':
            return (
              <GiftCTACardBlock
                key={key}
                locale={locale}
                heading={(section as { heading?: string }).heading}
                body={(section as { body?: string }).body}
                ctaLabel={(section as { ctaLabel?: string }).ctaLabel}
                ctaHref={(section as { ctaHref?: string }).ctaHref}
              />
            );
          case 'journal_teaser':
            return (
              <JournalTeaserBlock
                key={key}
                locale={locale}
                heading={(section as { heading?: string }).heading}
                posts={(section as { posts?: Parameters<typeof JournalTeaserBlock>[0]['posts'] }).posts}
              />
            );
          case 'trust_strip':
            return (
              <TrustStripBlock
                key={key}
                locale={locale}
                verifiedLabel={(section as { verifiedLabel?: string }).verifiedLabel}
                trustPoints={(section as { trustPoints?: Parameters<typeof TrustStripBlock>[0]['trustPoints'] }).trustPoints}
              />
            );
          default:
            console.error(
              `[homepage] unknown blockType "${section.blockType ?? 'undefined'}"`,
              section
            );
            return null;
  }
}
