import { SUPPORTED_LOCALES } from '@/i18n/routing';
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

/**
 * QD-02 — canonical route contract for footer navigation.
 *
 * Every path a market may configure maps onto ONE canonical destination, and the
 * destination — never the configured label — decides which chrome key renders.
 * Before QD-02 this table keyed on `/about` while every Polish market ships
 * `/o-nas`, so the i18n overlay missed and the raw YAML label ("O nas") rendered
 * on `/ua`, `/de` and `/en`. Recognition by route is what makes that impossible:
 * a route is a stable identifier, a label is copy.
 *
 * Aliases are the same destination expressed in different market vocabularies
 * (`/o-nas` ≡ `/about`, `/regulamin` ≡ `/terms`, …). They resolve to one key so
 * the chrome translation is authored once.
 */
const FOOTER_NAV_KEY_BY_CANONICAL_PATH: Record<string, string> = {
  '/o-nas': 'about',
  '/about': 'about',
  '/faq': 'faq',
  '/kontakt': 'kontakt',
  '/contact': 'kontakt',
  '/regulamin': 'regulamin',
  '/terms': 'regulamin',
  '/polityka-prywatnosci': 'polityka-prywatnosci',
  '/privacy': 'polityka-prywatnosci',
  '/pomoc': 'pomoc',
  '/help': 'pomoc',
  '/zasady': 'zasady'
};

// Path PARSING (not language exposure): nav paths configured in market.yaml may
// carry any platform locale prefix, so recognition uses the compile-time
// superset from routing.ts (ADR-150-4) instead of a hand-maintained copy.
// Which languages the market actually exposes is decided by the market-aware
// resolver (`@/lib/market-locales`) consumed by the middleware.
const FOOTER_NAV_LOCALE_SEGMENTS = new Set<string>(SUPPORTED_LOCALES);

function normalizeFooterNavI18nPath(path: string) {
  const [pathWithoutQuery] = path.split(/[?#]/);
  const withoutTrailingSlash = pathWithoutQuery.replace(/\/+$/, '') || '/';
  const segments = withoutTrailingSlash.split('/').filter(Boolean);

  if (segments.length > 1 && FOOTER_NAV_LOCALE_SEGMENTS.has(segments[0])) {
    return `/${segments.slice(1).join('/')}`;
  }

  return withoutTrailingSlash;
}

/**
 * Footer nav labels are CHROME: they must answer the route locale exactly, with
 * no cross-locale fallback (SPEC constraint, decision 2). So there is no
 * `fallbackLabel` parameter any more — returning the configured string would be
 * the very defect this package removes. An unresolvable link is dropped and
 * reported instead of being rendered in the wrong language.
 */
function resolveFooterNavLabel(
  path: string,
  translateNavLabel: FooterNavLabelResolver | undefined,
  marketId: string | null
): string | null {
  const canonicalPath = normalizeFooterNavI18nPath(path);
  const key = FOOTER_NAV_KEY_BY_CANONICAL_PATH[canonicalPath];

  if (!key) {
    console.warn(
      `[footer] market '${marketId ?? 'unknown'}' configures nav link '${path}' ` +
        'which is not in the canonical route contract — link dropped. Add the ' +
        'route to FOOTER_NAV_KEY_BY_CANONICAL_PATH together with its ' +
        'footer.nav.* key in messages/*.json.'
    );
    return null;
  }

  const label = translateNavLabel ? normalizeString(translateNavLabel(`nav.${key}`)) : null;

  if (!label) {
    console.warn(
      `[footer] missing chrome translation 'footer.nav.${key}' for the active ` +
        `locale (route '${path}') — link dropped rather than shown in another language.`
    );
    return null;
  }

  return label;
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

    const path = normalizeRelativePath(item.href);

    if (!path) {
      return [];
    }

    // `item.label` is deliberately NOT read. Both config sources still carry one
    // (Payload's column is NOT NULL), and reading it is exactly how the Polish
    // label reached /ua before QD-02.
    const label = resolveFooterNavLabel(
      path,
      translateNavLabel,
      normalizeString(marketConfig?.market_id)
    );

    if (!label) {
      return [];
    }

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

/**
 * QD-02 guard. By the time a market config reaches a component its `copyright`
 * has already been resolved to a string at the `resolveMarketConfig` boundary
 * (`resolveFooterLocalizedCopy`). If a locale map ever arrives here, some new
 * call path bypassed that boundary — rendering it would print `[object Object]`
 * or, worse, silently degrade to the fallback `© year name`. Fail loud instead:
 * this is the "mapa nie ma jak wyciec do JSX" invariant, enforced at runtime and
 * not only by the type.
 */
export function resolveFooterCopyright(marketConfig?: MarketConfig | null) {
  const rawCopyright = marketConfig?.footer?.copyright;

  if (rawCopyright !== null && rawCopyright !== undefined && typeof rawCopyright !== 'string') {
    throw new Error(
      '[footer] footer.copyright reached the renderer unresolved — expected a string, got ' +
        `${Array.isArray(rawCopyright) ? 'array' : typeof rawCopyright}. ` +
        'Market config must pass through resolveMarketConfig (QD-02 resolution boundary).'
    );
  }

  const copyright = normalizeString(rawCopyright);

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
