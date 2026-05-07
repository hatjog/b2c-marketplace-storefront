import { logger } from '@/lib/logger';

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
  max_height?: string | null;
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

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function normalizeText(value: string | null | undefined): string {
  return normalizeOptionalText(value) ?? '';
}

export function resolveBooleanFlag(value: boolean | null | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function shouldPrefixWithPortalBaseUrl(resolved: string) {
  return resolved.startsWith('/api/media/');
}

export function getImageUrl(image: HeroImage, fallback?: string, portalBaseUrl?: string): string | null {
  // !image catches null/undefined; || null normalizes empty strings to null
  const raw =
    !image ? null
    : typeof image === 'string' ? (image || null)
    : image.url || null;

  // Trim whitespace-only strings so they are treated as missing
  const resolved = raw?.trim() || null;

  if (resolved) {
    // Payload media endpoints stay rooted at Portal; same-origin app routes should remain untouched.
    if (portalBaseUrl && shouldPrefixWithPortalBaseUrl(resolved)) {
      const base = portalBaseUrl.replace(/\/$/, '');
      return `${base}${resolved}`;
    }
    return resolved;
  }

  if (fallback) {
    logger.warn('homepage.image.fallback_used', {
      source: 'homepage-utils',
      context: {
        fallback_url_present: Boolean(fallback),
        image_kind: typeof image === 'string' ? 'string' : (image == null ? 'null' : 'object'),
      },
    });
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
  portalBaseUrl?: string,
): ResolvedBannerSection | null {
  const heading = normalizeText(section.heading);
  const subheading = normalizeText(section.subheading);
  const label = normalizeText(section.label);
  const ctaLink = normalizeText(section.cta_link);
  const imageUrl = getImageUrl(section.image, fallback, portalBaseUrl);

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
  portalBaseUrl?: string,
): ResolvedStyleSectionItem[] {
  return (items ?? [])
    .map(item => {
      const label = normalizeText(item?.label);
      const href = normalizeText(item?.link);

      if (!label || !href) {
        return null;
      }

      return {
        imageUrl: getImageUrl(item?.image, fallback, portalBaseUrl),
        href,
        label,
      };
    })
    .filter((item): item is ResolvedStyleSectionItem => Boolean(item));
}

export function getStyleSectionData(
  section: StyleSectionBlock,
  fallback?: string,
  portalBaseUrl?: string,
): { heading: string; items: ResolvedStyleSectionItem[] } | null {
  const heading = normalizeText(section.heading);
  const items = normalizeStyleSectionItems(section.items, fallback, portalBaseUrl);

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
