import type { LegalEntity, MarketConfig } from '@/lib/portal';

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

function normalizeFooterConnectLinks(
  value: NonNullable<NonNullable<MarketConfig['footer']>['social']> | null | undefined
) {
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
  legalSignoffBadge?: FooterLegalSignoffBadge | null;
};

type FooterNavSection = {
  section: string;
  links: FooterNavLink[];
};

type FooterNavLabelResolver = (key: string) => string | null | undefined;

type LegalDocType = 'regulamin' | 'polityka_prywatnosci' | 'zasady_voucher' | 'pomoc';

type FooterLegalSignoffBadge = {
  docType: LegalDocType;
  status: 'accepted-in-house';
};

// Per-docType ledger status snapshot (Story 9.2 review-fix H1 2026-05-28):
// caller (Footer / SiteFooter async server component) loads ledger via
// `loadLegalSignoffStatusMap(marketId, runtimeLocale)` and passes the map in.
// Without the map (legacy callsite) badge stays hidden — explicit opt-in only.
export type LegalSignoffStatusByDocType = Partial<Record<LegalDocType, string>>;

const LEGAL_DOC_PATHS: Record<string, LegalDocType> = {
  '/regulamin': 'regulamin',
  '/polityka-prywatnosci': 'polityka_prywatnosci',
  '/zasady': 'zasady_voucher',
  '/pomoc': 'pomoc'
};

const FOOTER_NAV_I18N_KEYS_BY_PATH: Record<string, string> = {
  '/about': 'nav.about',
  '/faq': 'nav.faq',
  '/kontakt': 'nav.kontakt',
  '/regulamin': 'nav.regulamin',
  '/polityka-prywatnosci': 'nav.polityka-prywatnosci'
};

const FOOTER_NAV_LOCALE_SEGMENTS = new Set(['pl', 'en', 'ua', 'de']);

function normalizeFooterNavI18nPath(path: string) {
  const [pathWithoutQuery] = path.split(/[?#]/);
  const withoutTrailingSlash = pathWithoutQuery.replace(/\/+$/, '') || '/';
  const segments = withoutTrailingSlash.split('/').filter(Boolean);

  if (segments.length > 1 && FOOTER_NAV_LOCALE_SEGMENTS.has(segments[0])) {
    return `/${segments.slice(1).join('/')}`;
  }

  return withoutTrailingSlash;
}

function resolveFooterNavLabel(
  path: string,
  fallbackLabel: string,
  translateNavLabel?: FooterNavLabelResolver
) {
  const key = FOOTER_NAV_I18N_KEYS_BY_PATH[normalizeFooterNavI18nPath(path)];
  if (!key || !translateNavLabel) {
    return fallbackLabel;
  }

  return normalizeString(translateNavLabel(key)) ?? fallbackLabel;
}

export function resolveFooterLegalSignoffBadge(
  marketConfig: MarketConfig | null | undefined,
  path: string,
  statusByDocType?: LegalSignoffStatusByDocType | null
): FooterLegalSignoffBadge | null {
  const docType = LEGAL_DOC_PATHS[path];
  const marketId = normalizeString(marketConfig?.market_id);

  if (!docType || !marketId) {
    return null;
  }

  // Ledger-driven: badge tylko jeśli (market, locale, docType) ma faktyczny
  // `status: accepted-in-house` w sign-off ledger. Brak mapy lub status inny
  // niż `accepted-in-house` (DRAFT / WAIVED-demo / WAIVED-interim / published) =
  // badge hidden. Hard-coded `marketId === 'bonbeauty'` shortcut usunięty.
  const ledgerStatus = statusByDocType?.[docType];
  if (ledgerStatus !== 'accepted-in-house') {
    return null;
  }

  return {
    docType,
    status: 'accepted-in-house'
  };
}

export function resolveFooterNavLinks(
  marketConfig?: MarketConfig | null,
  legalSignoffStatusByDocType?: LegalSignoffStatusByDocType | null,
  translateNavLabel?: FooterNavLabelResolver
): FooterNavSection[] {
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

    const fallbackLabel = normalizeString(item.label);
    const path = normalizeRelativePath(item.href);

    if (!fallbackLabel || !path) {
      return [];
    }

    const label = resolveFooterNavLabel(path, fallbackLabel, translateNavLabel);
    const legalSignoffBadge = resolveFooterLegalSignoffBadge(
      marketConfig,
      path,
      legalSignoffStatusByDocType
    );
    return [{ label, path, ...(legalSignoffBadge ? { legalSignoffBadge } : {}) }];
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

export function resolveFooterLegalEntity(marketConfig?: MarketConfig | null): LegalEntity | null {
  const entity = marketConfig?.legal_entity;

  if (!entity) {
    return null;
  }

  const name = normalizeString(entity.name);
  const address = normalizeString(entity.address);
  const tax_id = normalizeString(entity.tax_id);

  if (!name || !address || !tax_id) {
    return null;
  }

  return {
    name,
    address,
    tax_id,
    email: normalizeString(entity.email) ?? null,
    phone: normalizeString(entity.phone) ?? null
  };
}
