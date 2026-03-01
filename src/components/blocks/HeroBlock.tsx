import Link from 'next/link';

import { Hero } from '@/components/sections';

type HeroButton = {
  label?: string | null;
  url?: string | null;
  variant?: string | null;
};

type HeroImage =
  | string
  | {
      url?: string | null;
    }
  | null
  | undefined;

export type HeroSectionBlock = {
  heading?: string | null;
  paragraph?: string | null;
  image?: HeroImage;
  buttons?: HeroButton[] | null;
};

function getImageUrl(image: HeroImage): string | null {
  if (!image) {
    return null;
  }

  if (typeof image === 'string') {
    return image;
  }

  return image.url ?? null;
}

function mapButtons(buttons: HeroButton[] | null | undefined) {
  return (buttons ?? [])
    .map(button => {
      if (!button?.label || !button.url) {
        return null;
      }

      return {
        label: button.label,
        path: button.url
      };
    })
    .filter((button): button is { label: string; path: string } => Boolean(button));
}

export function HeroBlock({ section }: { section: HeroSectionBlock }) {
  const heading = section.heading ?? '';
  const paragraph = section.paragraph ?? '';
  const imageUrl = getImageUrl(section.image);
  const buttons = mapButtons(section.buttons);

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

  if (section.image == null) {
    console.error('[homepage] hero image is missing or invalid', section);
  }

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
