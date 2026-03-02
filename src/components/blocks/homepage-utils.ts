export type HeroButton = {
  label?: string | null;
  url?: string | null;
  variant?: string | null;
};

export type HeroImage =
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

export type RawSection = {
  id?: string | number;
  blockType?: string;
  enabled?: boolean | null;
  [key: string]: unknown;
};

export function getImageUrl(image: HeroImage): string | null {
  if (!image) {
    return null;
  }

  if (typeof image === 'string') {
    return image;
  }

  return image.url ?? null;
}

export function mapButtons(buttons: HeroButton[] | null | undefined) {
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

export function isSectionObject(section: unknown): section is RawSection {
  return typeof section === 'object' && section !== null;
}
