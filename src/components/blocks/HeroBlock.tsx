/**
 * HeroBlock — wraps the Hero section for homepage block rendering.
 *
 * v1.7.0 Story 2.2:
 *   - Passes trustMarkLabel (i18n key: category.trust_mark_label) to Hero
 *     so MarketplaceVerificationMark (UX-CMP-1) is locale-aware.
 *   - Server component async to use getTranslations.
 */
import { getTranslations } from 'next-intl/server';

import { Hero } from '@/components/sections/Hero/Hero';

import {
  type HeroSectionBlock,
  getImageUrl,
  mapButtons,
  normalizeOptionalText,
} from './homepage-utils';

export type { HeroSectionBlock };

export async function HeroBlock({ section }: { section: HeroSectionBlock }) {
  const heading = section.heading ?? '';
  const paragraph = section.paragraph ?? '';
  const imageUrl = getImageUrl(section.image, '/images/hero/Image.jpg', process.env.PAYLOAD_API_URL);
  const buttons = mapButtons(section.buttons);
  const maxHeight = normalizeOptionalText(section.max_height);

  const t = await getTranslations('category');
  const tHomeHero = await getTranslations('home_v3.hero');
  const trustMarkLabel = t('trust_mark_label');
  // v1.7.0 Story 2.2 re-review fix (HIGH H1'): resolve hero image alt through
  // i18n instead of the previous hardcoded EN `Hero banner - ${heading}` literal.
  // ICU interpolation: `category.hero_image_alt` = "Hero banner — {heading}".
  const imageAlt = t('hero_image_alt', { heading: heading || '' });

  if (!heading && !paragraph && !imageUrl && buttons.length === 0) {
    return null;
  }

  if (imageUrl) {
    return (
      <Hero
        image={imageUrl}
        heading={heading}
        paragraph={paragraph}
        buttons={buttons}
        maxHeight={maxHeight}
        showSearch={true}
        trustMarkLabel={trustMarkLabel}
        imageAlt={imageAlt}
        secondaryVoucherCtaLabel={tHomeHero('secondary_voucher_cta')}
      />
    );
  }

  // Last-resort: unreachable when fallback is provided; kept as defensive safety net
  return (
    <section className="container mt-5 flex w-full flex-col text-primary lg:flex-row">
      <div className="w-full">
        <div className="w-full rounded-sm border px-6 py-8">
          <h2 className="display-md mb-6 max-w-[652px] text-4xl font-bold uppercase leading-tight md:text-5xl">
            {heading}
          </h2>
          <p className="mb-8 text-lg">{paragraph}</p>
        </div>
      </div>
    </section>
  );
}
