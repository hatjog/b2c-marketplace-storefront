// Source: portal/src/collections/MarketConfig.ts
import type { SupportedLocale } from '@/i18n/routing';
import type { LocalizedConfigValue } from '@/lib/i18n/localized-config-value';
import type { LegalEntity, MarketSocialLinks } from '@/lib/runtime-market-config';

export type { LegalEntity };

import type { StorefrontFilterConfig } from '@/components/cells/DynamicFilterSidebar/DynamicFilterSidebar';
export type { StorefrontFilterConfig };

type MarketConfigLogo = {
  url?: string | null;
};

type MarketConfigSeoDefaults = {
  title_pattern?: string | null;
};

type MarketConfigFooterLink = {
  /**
   * QD-02: for `nav_links` this is NOT consumed. Both config sources still carry
   * one (Payload's column is NOT NULL, so the seed writes the route there), but
   * the rendered label comes from the canonical route contract in
   * `src/lib/footer.ts` → `messages/*.json`. Reading it is what put "O nas" on
   * /ua. For `social` it IS the label — a platform name, not localizable copy.
   */
  label?: string | null;
  href?: string | null;
  enabled?: boolean | null;
};

/**
 * QD-02 — a footer copyright that fell back to `market.locales.default`.
 * `whole` is always true: `copyright` is a single field in a single element, so
 * there is no correctly-translated sibling that `lang` could mislabel.
 */
export type FooterCopyrightFallback = {
  locale: SupportedLocale;
  whole: boolean;
  fromLegacyScalar: boolean;
};

type MarketConfigFooter = {
  /**
   * A locale map BEFORE `resolveMarketConfig`, a plain string after it. The
   * union is deliberate: it makes every consumer that skips the resolution
   * boundary a type error instead of an `[object Object]` in the DOM.
   */
  copyright?: string | LocalizedConfigValue | null;
  copyright_fallback?: FooterCopyrightFallback | null;
  social?: MarketConfigFooterLink[] | null;
  nav_links?: MarketConfigFooterLink[] | null;
};

type MarketConfigPublicProfile = {
  social_links?: MarketSocialLinks | null;
};

export type MarketConfig = {
  id?: string;
  market_id?: string;
  name?: string | null;
  logo?: MarketConfigLogo | string | null;
  primary_color?: string | null;
  theme?: string | null;
  seo_defaults?: MarketConfigSeoDefaults | null;
  footer?: MarketConfigFooter | null;
  public_profile?: MarketConfigPublicProfile | null;
  storefront_filters?: StorefrontFilterConfig[] | null;
  homepage_sections?: unknown[] | null;
  tenant?: string | { id?: string | number } | null;
  favicon?: MarketConfigLogo | string | null;
  vendor_panel_url?: string | null;
  legal_entity?: LegalEntity | null;
};

export function getMarketLogoUrl(marketConfig: MarketConfig | null | undefined) {
  const logo = marketConfig?.logo;

  if (!logo) {
    return null;
  }

  if (typeof logo === 'string') {
    return logo;
  }

  return logo.url ?? null;
}

export function getMarketFaviconUrl(marketConfig: MarketConfig | null | undefined) {
  const favicon = marketConfig?.favicon;

  if (!favicon) {
    return null;
  }

  if (typeof favicon === 'string') {
    return favicon;
  }

  return favicon.url ?? null;
}

export function getFallbackMarketConfig(marketId: string): MarketConfig {
  const fallbackMarketName = marketId || 'market';

  return {
    market_id: marketId,
    name: fallbackMarketName,
    logo: null,
    primary_color: null,
    theme: null,
    footer: null,
    public_profile: null,
    seo_defaults: {
      title_pattern: `%s | ${fallbackMarketName}`
    },
    storefront_filters: null,
    homepage_sections: null,
    tenant: null,
    favicon: null,
    vendor_panel_url: null
  };
}
