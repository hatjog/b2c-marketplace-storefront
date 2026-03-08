export type HeroButton = {
  label?: string | null;
  url?: string | null;
  path?: string | null;
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

export type BannerSectionBlock = {
  heading?: string | null;
  subheading?: string | null;
  image?: HeroImage;
  label?: string | null;
  cta_link?: string | null;
};

export type StyleSectionItem = {
  image?: HeroImage;
  link?: string | null;
  label?: string | null;
};

export type StyleSectionBlock = {
  heading?: string | null;
  items?: StyleSectionItem[] | null;
};

export type ResolvedBannerSection = {
  heading: string;
  subheading: string;
  imageUrl: string | null;
  label: string;
  ctaLink: string;
};

export type ResolvedStyleSectionItem = {
  imageUrl: string | null;
  href: string;
  label: string;
};

export type RawSection = {
  id?: string | number;
  blockType?: string;
  enabled?: boolean | null;
  [key: string]: unknown;
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function getImageUrl(image: HeroImage, fallback?: string): string | null {
  // !image catches null/undefined; || null normalizes empty strings to null
  const resolved =
    !image ? null
    : typeof image === 'string' ? (image || null)
    : image.url || null;

  if (resolved) return resolved;

  if (fallback) {
    // TODO(Faza 2): replace with structured logging (Sentry/Portal API) — warn masks upstream seed/backfill issues
    console.warn('[homepage] image missing, using fallback:', fallback);
    return fallback;
  }
  return null;
}

export function mapButtons(buttons: HeroButton[] | null | undefined) {
  return (buttons ?? [])
    .map(button => {
      const href = button?.url ?? button?.path;

      if (!button?.label || !href) {
        return null;
      }

      return {
        label: button.label,
        path: href
      };
    })
    .filter((button): button is { label: string; path: string } => Boolean(button));
}

export function getBannerSectionData(
  section: BannerSectionBlock,
  fallback?: string,
): ResolvedBannerSection | null {
  const heading = normalizeText(section.heading);
  const subheading = normalizeText(section.subheading);
  const label = normalizeText(section.label);
  const ctaLink = normalizeText(section.cta_link);
  const imageUrl = getImageUrl(section.image, fallback);

  if ((!heading && !subheading) || !label || !ctaLink) {
    return null;
  }

  return {
    heading,
    subheading,
    imageUrl,
    label,
    ctaLink,
  };
}

export function normalizeStyleSectionItems(
  items: StyleSectionItem[] | null | undefined,
  fallback?: string,
): ResolvedStyleSectionItem[] {
  return (items ?? [])
    .map(item => {
      const label = normalizeText(item?.label);
      const href = normalizeText(item?.link);

      if (!label || !href) {
        return null;
      }

      return {
        imageUrl: getImageUrl(item?.image, fallback),
        href,
        label,
      };
    })
    .filter((item): item is ResolvedStyleSectionItem => Boolean(item));
}

export function getStyleSectionData(
  section: StyleSectionBlock,
  fallback?: string,
): { heading: string; items: ResolvedStyleSectionItem[] } | null {
  const heading = normalizeText(section.heading);
  const items = normalizeStyleSectionItems(section.items, fallback);

  if (!heading || items.length === 0) {
    return null;
  }

  return {
    heading,
    items,
  };
}

export function isSectionObject(section: unknown): section is RawSection {
  return typeof section === 'object' && section !== null;
}
