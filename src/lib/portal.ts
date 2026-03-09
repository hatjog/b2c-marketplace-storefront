import type { MarketSocialLinks } from '@/lib/runtime-market-config';

type MarketConfigLogo = {
  url?: string | null;
};

type MarketConfigSeoDefaults = {
  title_pattern?: string | null;
};

type MarketConfigFooterLink = {
  label?: string | null;
  href?: string | null;
  enabled?: boolean | null;
};

type MarketConfigNavLink = {
  label?: string | null;
  path?: string | null;
};

type MarketConfigNavSection = {
  section?: string | null;
  links?: MarketConfigNavLink[] | null;
};

type MarketConfigFooter = {
  copyright?: string | null;
  social?: MarketConfigFooterLink[] | null;
  nav_links?: MarketConfigNavSection[] | null;
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
  [key: string]: unknown;
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
    }
  };
}
