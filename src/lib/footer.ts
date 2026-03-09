import type { MarketConfig } from '@/lib/portal';

type FooterConnectLink = {
  label: string;
  href: string;
};

const SOCIAL_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter'
} as const;

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRelativePath(value: unknown) {
  const candidate = normalizeString(value);
  if (!candidate) {
    return null;
  }

  if (!candidate.startsWith('/')) {
    return null;
  }

  return candidate;
}

function normalizeHttpUrl(value: unknown) {
  const candidate = normalizeString(value);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

function normalizeFooterConnectLinks(value: NonNullable<NonNullable<MarketConfig['footer']>['social']> | null | undefined) {
  if (!Array.isArray(value)) {
    return [] satisfies FooterConnectLink[];
  }

  return value.flatMap(item => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const label = normalizeString(item.label);
    const href = normalizeHttpUrl(item.href);

    if (!label || !href) {
      return [];
    }

    return [{ label, href }];
  });
}

function hasExplicitFooterSocialConfig(marketConfig?: MarketConfig | null) {
  return Array.isArray(marketConfig?.footer?.social);
}

function mapRuntimeSocialLinks(marketConfig?: MarketConfig | null) {
  const socialLinks = marketConfig?.public_profile?.social_links;
  if (!socialLinks) {
    return [] satisfies FooterConnectLink[];
  }

  return (Object.keys(SOCIAL_LABELS) as Array<keyof typeof SOCIAL_LABELS>).flatMap(key => {
    const href = normalizeHttpUrl(socialLinks[key]);
    if (!href) {
      return [];
    }

    return [{ label: SOCIAL_LABELS[key], href }];
  });
}

export function resolveFooterConnectLinks(marketConfig?: MarketConfig | null) {
  if (hasExplicitFooterSocialConfig(marketConfig)) {
    return normalizeFooterConnectLinks(marketConfig?.footer?.social);
  }

  const runtimeSocialLinks = mapRuntimeSocialLinks(marketConfig);
  if (runtimeSocialLinks.length > 0) {
    return runtimeSocialLinks;
  }

  return [];
}

type FooterNavLink = {
  label: string;
  path: string;
};

type FooterNavSection = {
  section: string;
  links: FooterNavLink[];
};

export function resolveFooterNavLinks(marketConfig?: MarketConfig | null): FooterNavSection[] {
  const navLinks = marketConfig?.footer?.nav_links;

  if (!Array.isArray(navLinks)) {
    return [];
  }

  // Payload stores nav_links as flat array: { label, href, enabled }
  const links = navLinks.flatMap(item => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    if (item.enabled === false) {
      return [];
    }

    const label = normalizeString(item.label);
    const path = normalizeRelativePath(item.href);

    if (!label || !path) {
      return [];
    }

    return [{ label, path }];
  });

  if (links.length === 0) {
    return [];
  }

  // Payload stores flat nav_links without section grouping.
  // Default to 'about' section — maps to i18n key 'section_about' in Footer.
  return [{ section: 'about', links }];
}

export function resolveFooterCopyright(marketConfig?: MarketConfig | null) {
  const copyright = normalizeString(marketConfig?.footer?.copyright);

  if (copyright) {
    return copyright;
  }

  const marketName = normalizeString(marketConfig?.name);
  const year = new Date().getFullYear();

  return marketName ? `© ${year} ${marketName}` : `© ${year} Fleek`;
}