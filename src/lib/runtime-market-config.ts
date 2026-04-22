import fs from 'node:fs/promises';
import path from 'node:path';

import * as Sentry from '@sentry/nextjs';
import yaml from 'js-yaml';
import { cache } from 'react';

import type { MarketConfig } from '@/lib/portal';

const SOCIAL_LINK_KEYS = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter'
] as const;

export type MarketSocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];

export type MarketSocialLinks = Partial<Record<MarketSocialLinkKey, string>>;

export type LegalEntity = {
  name: string;
  address: string;
  tax_id: string;
  email?: string | null;
  phone?: string | null;
};

type MarketRuntimeConfig = {
  market_id?: string | null;
  name?: string | null;
  public_profile?: {
    social_links?: Record<string, unknown> | null;
  } | null;
  storefront?: {
    theme?: string | null;
    primary_color?: string | null;
    seo_defaults?: Record<string, unknown> | null;
    footer?: Record<string, unknown> | null;
    vendor_panel_url?: string | null;
    storefront_filters?: unknown;
    logo?: unknown;
    favicon?: unknown;
    pdp_trust_signals?: string[] | null;
    default_validity_info?: string | null;
    zasady_sections?: Array<{ title: string; body: string }> | null;
  } | null;
  legal_entity?: Record<string, unknown> | null;
};

type HomepageRuntimeConfig = {
  sections?: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fileExists(candidatePath: string) {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

const resolveConfigRoot = cache(async () => {
  const envConfigRoot = process.env.GP_CONFIG_ROOT?.trim();
  if (envConfigRoot) {
    return envConfigRoot;
  }

  const candidates = [path.resolve(process.cwd(), '../config'), path.resolve(process.cwd(), '../../config')];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
});

function getMarketConfigPath(configRoot: string, marketId: string) {
  const instanceId = process.env.GP_INSTANCE_ID?.trim() || 'gp-dev';

  return path.resolve(configRoot, instanceId, 'markets', marketId, 'market.yaml');
}

function getHomepageConfigPath(configRoot: string, marketId: string) {
  const instanceId = process.env.GP_INSTANCE_ID?.trim() || 'gp-dev';

  return path.resolve(configRoot, instanceId, 'markets', marketId, 'homepage.yaml');
}

async function readYamlRecord(filePath: string, errorScope: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = yaml.load(raw);

    return isRecord(parsed) ? parsed : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null;
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(`[${errorScope}] failed to load ${filePath}`);
    }

    console.error(`[${errorScope}] failed to load ${filePath}`, error);
    return null;
  }
}

const readRuntimeMarketConfig = cache(async (marketId: string): Promise<MarketRuntimeConfig | null> => {
  if (!marketId) {
    return null;
  }

  const configRoot = await resolveConfigRoot();
  const marketConfigPath = getMarketConfigPath(configRoot, marketId);

  const parsed = await readYamlRecord(marketConfigPath, 'runtime-market-config');
  return parsed as MarketRuntimeConfig | null;
});

const readRuntimeHomepageConfig = cache(async (marketId: string): Promise<HomepageRuntimeConfig | null> => {
  if (!marketId) {
    return null;
  }

  const configRoot = await resolveConfigRoot();
  const homepageConfigPath = getHomepageConfigPath(configRoot, marketId);
  const parsed = await readYamlRecord(homepageConfigPath, 'runtime-homepage-config');

  return parsed as HomepageRuntimeConfig | null;
});

export function normalizeSocialLinks(value: unknown): MarketSocialLinks | null {
  if (!isRecord(value)) {
    return null;
  }

  const entries = SOCIAL_LINK_KEYS.flatMap(key => {
    const href = normalizeUrl(value[key]);
    return href ? [[key, href] as const] : [];
  });

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries) as MarketSocialLinks;
}

export const resolveRuntimeSocialLinks = cache(async (marketId: string) => {
  const config = await readRuntimeMarketConfig(marketId);
  return normalizeSocialLinks(config?.public_profile?.social_links);
});

export const resolvePdpTrustSignals = cache(async (marketId: string): Promise<string[]> => {
  const config = await readRuntimeMarketConfig(marketId);
  const signals = config?.storefront?.pdp_trust_signals;
  return Array.isArray(signals) ? signals : [];
});

export const resolveDefaultValidityInfo = cache(async (marketId: string): Promise<string | null> => {
  const config = await readRuntimeMarketConfig(marketId);
  return config?.storefront?.default_validity_info ?? null;
});

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHttpUrl(value: unknown): string | null {
  const candidate = normalizeNonEmptyString(value);
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : null;
  } catch {
    return null;
  }
}

function normalizeRelativePath(value: unknown): string | null {
  const candidate = normalizeNonEmptyString(value);
  if (!candidate || !candidate.startsWith('/')) {
    return null;
  }

  return candidate;
}

function normalizeAssetReference(value: unknown): string | null {
  return normalizeHttpUrl(value) ?? normalizeRelativePath(value);
}

function normalizeTitlePattern(value: unknown): string | null {
  const pattern = normalizeNonEmptyString(value);
  if (!pattern) {
    return null;
  }

  return pattern.replaceAll('{page}', '%s');
}

function normalizeMarketName(value: unknown, titlePattern: string | null, marketId: string): string | null {
  const explicitName = normalizeNonEmptyString(value);
  if (explicitName) {
    return explicitName;
  }

  const inferredName = titlePattern
    ?.replaceAll('%s', '')
    .replaceAll('{page}', '')
    .replace(/^[\s|:—-]+|[\s|:—-]+$/g, '');
  if (inferredName) {
    return inferredName;
  }

  const normalizedMarketId = normalizeNonEmptyString(marketId);
  if (!normalizedMarketId) {
    return null;
  }

  return normalizedMarketId.charAt(0).toUpperCase() + normalizedMarketId.slice(1);
}

function normalizeFooterSocialLabel(value: unknown): string | null {
  const explicitLabel = normalizeNonEmptyString(value);
  if (explicitLabel) {
    return explicitLabel;
  }

  const platform = normalizeNonEmptyString(value);
  return platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : null;
}

function normalizeFooterSocialLinks(
  value: unknown
): NonNullable<NonNullable<MarketConfig['footer']>['social']> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const links = value.flatMap(item => {
    if (!isRecord(item)) {
      return [];
    }

    const href = normalizeHttpUrl(item.href) ?? normalizeHttpUrl(item.url);
    const label = normalizeNonEmptyString(item.label) ?? normalizeFooterSocialLabel(item.platform);

    if (!href || !label) {
      return [];
    }

    return [{ label, href }];
  });

  return links.length > 0 ? links : null;
}

function normalizeFooterNavLinks(
  value: unknown
): NonNullable<NonNullable<MarketConfig['footer']>['nav_links']> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const links = value.flatMap(item => {
    if (!isRecord(item)) {
      return [];
    }

    const label = normalizeNonEmptyString(item.label);
    const href = normalizeRelativePath(item.href) ?? normalizeRelativePath(item.url);
    const enabled = typeof item.enabled === 'boolean' ? item.enabled : null;

    if (!label || !href) {
      return [];
    }

    return [{ label, href, enabled }];
  });

  return links.length > 0 ? links : null;
}

function normalizeFooter(value: unknown): MarketConfig['footer'] | null {
  if (!isRecord(value)) {
    return null;
  }

  const copyright = normalizeNonEmptyString(value.copyright);
  const social = normalizeFooterSocialLinks(value.social);
  const nav_links = normalizeFooterNavLinks(value.nav_links);

  if (!copyright && !social && !nav_links) {
    return null;
  }

  return {
    copyright,
    social,
    nav_links
  };
}

function normalizeHomepageImage(value: unknown) {
  if (typeof value === 'string') {
    return normalizeAssetReference(value);
  }

  if (!isRecord(value)) {
    return null;
  }

  const url = normalizeAssetReference(value.url);
  return url ? { url } : null;
}

function normalizeHomepageButtons(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const buttons = value.flatMap(item => {
    if (!isRecord(item)) {
      return [];
    }

    const label = normalizeNonEmptyString(item.label);
    const path = normalizeNonEmptyString(item.path) ?? normalizeNonEmptyString(item.url);
    const variant = normalizeNonEmptyString(item.variant);

    if (!label || !path) {
      return [];
    }

    return [{ label, path, variant }];
  });

  return buttons.length > 0 ? buttons : null;
}

function normalizeStyleSectionItems(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.flatMap(item => {
    if (!isRecord(item)) {
      return [];
    }

    const label = normalizeNonEmptyString(item.label);
    const link = normalizeNonEmptyString(item.link);
    const image = normalizeHomepageImage(item.image);

    if (!label || !link) {
      return [];
    }

    return [{ label, link, image }];
  });

  return items.length > 0 ? items : null;
}

function normalizeHomepageSections(
  value: HomepageRuntimeConfig | null
): MarketConfig['homepage_sections'] | null {
  if (!isRecord(value?.sections)) {
    return null;
  }

  const blocks = Object.entries(value.sections).flatMap(([blockType, section]) => {
    if (!isRecord(section)) {
      return [];
    }

    const normalizedSection: Record<string, unknown> = {
      id: blockType,
      blockType,
      ...section
    };

    if ('image' in section) {
      normalizedSection.image = normalizeHomepageImage(section.image);
    }

    if ('buttons' in section) {
      normalizedSection.buttons = normalizeHomepageButtons(section.buttons);
    }

    if ('items' in section) {
      normalizedSection.items = normalizeStyleSectionItems(section.items);
    }

    return [normalizedSection];
  });

  return blocks.length > 0 ? blocks : null;
}

export function normalizeLegalEntity(value: unknown): LegalEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeNonEmptyString(value.name);
  const address = normalizeNonEmptyString(value.address);
  const tax_id = normalizeNonEmptyString(value.tax_id);

  if (!name || !address || !tax_id) {
    return null;
  }

  return {
    name,
    address,
    tax_id,
    email: normalizeNonEmptyString(value.email),
    phone: normalizeNonEmptyString(value.phone)
  };
}

export function normalizeZasadySection(value: unknown): { title: string; body: string } | null {
  if (!isRecord(value)) return null;
  const title = normalizeNonEmptyString(value.title);
  const body = normalizeNonEmptyString(value.body);
  if (!title || !body) return null;
  return { title, body };
}

export const resolveZasadySections = cache(async (
  marketId: string
): Promise<Array<{ title: string; body: string }> | null> => {
  const config = await readRuntimeMarketConfig(marketId);
  const sections = config?.storefront?.zasady_sections;
  if (!Array.isArray(sections)) return null;
  const valid = sections.flatMap(item => {
    const normalized = normalizeZasadySection(item);
    return normalized ? [normalized] : [];
  });
  return valid.length > 0 ? valid : null;
});

export const resolveLegalEntity = cache(async (marketId: string): Promise<LegalEntity | null> => {
  const config = await readRuntimeMarketConfig(marketId);
  return normalizeLegalEntity(config?.legal_entity);
});

export const resolveRuntimePortalMarketConfig = cache(async (
  marketId: string
): Promise<MarketConfig | null> => {
  if (!marketId) {
    return null;
  }

  const [marketConfig, homepageConfig] = await Promise.all([
    readRuntimeMarketConfig(marketId),
    readRuntimeHomepageConfig(marketId)
  ]);

  if (!marketConfig && !homepageConfig) {
    return null;
  }

  const titlePattern = normalizeTitlePattern(marketConfig?.storefront?.seo_defaults?.title_pattern);

  return {
    market_id: normalizeNonEmptyString(marketConfig?.market_id) ?? marketId,
    name: normalizeMarketName(marketConfig?.name, titlePattern, marketId),
    logo: normalizeAssetReference(marketConfig?.storefront?.logo),
    primary_color: normalizeNonEmptyString(marketConfig?.storefront?.primary_color),
    theme: normalizeNonEmptyString(marketConfig?.storefront?.theme),
    seo_defaults: titlePattern ? { title_pattern: titlePattern } : null,
    footer: normalizeFooter(marketConfig?.storefront?.footer),
    public_profile: {
      social_links: normalizeSocialLinks(marketConfig?.public_profile?.social_links)
    },
    storefront_filters: Array.isArray(marketConfig?.storefront?.storefront_filters)
      ? (marketConfig.storefront.storefront_filters as MarketConfig['storefront_filters'])
      : null,
    homepage_sections: normalizeHomepageSections(homepageConfig),
    tenant: null,
    favicon: normalizeAssetReference(marketConfig?.storefront?.favicon),
    vendor_panel_url: normalizeHttpUrl(marketConfig?.storefront?.vendor_panel_url),
    legal_entity: normalizeLegalEntity(marketConfig?.legal_entity)
  } satisfies MarketConfig;
});
