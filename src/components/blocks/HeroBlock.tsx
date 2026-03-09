import Link from 'next/link';

import { Hero } from '@/components/sections/Hero/Hero';

import {
  type HeroSectionBlock,
  getImageUrl,
  mapButtons
} from './homepage-utils';

export type { HeroSectionBlock };

export function HeroBlock({ section }: { section: HeroSectionBlock }) {
  const heading = section.heading ?? '';
  const paragraph = section.paragraph ?? '';
  const imageUrl = getImageUrl(section.image, '/images/hero/Image.jpg', process.env.PAYLOAD_API_URL);
  const buttons = mapButtons(section.buttons);

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
          {buttons.length > 0 && (
            <div className="flex gap-4 font-bold uppercase">
              {buttons.map(({ label, path }) => (
                <Link
                  key={path}
                  href={path}
                  className="bg-content group flex rounded-sm border p-4 transition-all duration-300 hover:bg-action hover:text-tertiary"
                  aria-label={label}
                  title={label}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
