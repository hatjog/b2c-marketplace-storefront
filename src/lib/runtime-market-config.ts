import fs from 'node:fs/promises';
import path from 'node:path';

import * as Sentry from '@sentry/nextjs';
import yaml from 'js-yaml';
import { cache } from 'react';

import type { MarketConfig } from '@/lib/portal';

const RUNTIME_ASSET_ROUTE_BASE = '/api/runtime-market-assets';

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

// Mirrors `properties.locales` of market-runtime-config.v1.schema.json (D-61):
// key set is drift-tested against the schema (Story 1.1 v1.14.0, AC4 parity).
export type MarketLocalesRuntimeBlock = {
  default?: unknown;
  supported?: unknown;
  fallback_chain?: unknown;
};

export type MarketRuntimeConfig = {
  market_id?: string | null;
  name?: string | null;
  locales?: MarketLocalesRuntimeBlock | null;
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

function getRuntimeInstanceId() {
  return process.env.GP_INSTANCE_ID?.trim() || 'gp-dev';
}

function getMarketRootPath(configRoot: string, marketId: string) {
  return path.resolve(configRoot, getRuntimeInstanceId(), 'markets', marketId);
}

function getMarketConfigPath(configRoot: string, marketId: string) {
  return path.resolve(getMarketRootPath(configRoot, marketId), 'market.yaml');
}

function getHomepageConfigPath(configRoot: string, marketId: string) {
  return path.resolve(getMarketRootPath(configRoot, marketId), 'homepage.yaml');
}

// Single-tenant assumption: this function is invoked only when NEXT_PUBLIC_PAYLOAD_MARKET_ID
// is empty (i.e. single-market / local deploy without Payload market configuration).
// With multiple markets in the directory, it returns the first alphabetical market that has
// a non-empty storefront.theme; if none has a theme, it returns the first parseable market.
// In a true multi-tenant deploy NEXT_PUBLIC_PAYLOAD_MARKET_ID should always be set, so
// reaching this function is unexpected and may silently pick the wrong market.
async function discoverRuntimeMarketId(configRoot: string): Promise<string | null> {
  const marketsRoot = path.resolve(configRoot, getRuntimeInstanceId(), 'markets');

  let marketEntries: string[];
  try {
    const entries = await fs.readdir(marketsRoot, { withFileTypes: true });
    marketEntries = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null;
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(`[runtime-market-config] failed to discover markets in ${marketsRoot}`);
    }

    console.error(`[runtime-market-config] failed to discover markets in ${marketsRoot}`, error);
    return null;
  }

  let firstConfiguredMarket: string | null = null;

  for (const marketId of marketEntries) {
    const parsed = await readYamlRecord(getMarketConfigPath(configRoot, marketId), 'runtime-market-config');
    if (!parsed) {
      continue;
    }

    firstConfiguredMarket ??= marketId;

    if (normalizeNonEmptyString((parsed as MarketRuntimeConfig).storefront?.theme)) {
      return marketId;
    }
  }

  return firstConfiguredMarket;
}

export async function resolveRuntimeMarketId(marketId: string): Promise<string | null> {
  const normalizedMarketId = normalizeNonEmptyString(marketId);
  if (normalizedMarketId) {
    return normalizedMarketId;
  }

  const configRoot = await resolveConfigRoot();
  return discoverRuntimeMarketId(configRoot);
}

async function readYamlRecord(
  filePath: string,
  errorScope: string,
  options: { rethrowTransient?: boolean } = {}
): Promise<Record<string, unknown> | null> {
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

    // Story 1.1 v1.14.0 F2 fix: non-ENOENT fs errors (EMFILE/EIO/transient mount
    // races) are NOT config-validation failures — callers that need to tell
    // "config genuinely absent" apart from "transient I/O hiccup" (e.g. the
    // market-locales resolver's cached-rejection semantics) opt in via
    // `rethrowTransient` instead of getting a silent `null`.
    if (options.rethrowTransient) {
      throw error;
    }

    return null;
  }
}

// When marketId is empty, resolveRuntimeMarketId triggers market discovery, and ALL config
// fields (name, logo, legal_entity, SEO, social_links, theme) are resolved from the
// discovered market's YAML. This is intentional: it ensures full coherence of all fields
// from a single source rather than a partial per-field fallback (ADR-145, ADR-126/127).
export const readRuntimeMarketConfig = cache(async (marketId: string): Promise<MarketRuntimeConfig | null> => {
  const resolvedMarketId = await resolveRuntimeMarketId(marketId);
  if (!resolvedMarketId) {
    return null;
  }

  const configRoot = await resolveConfigRoot();
  const marketConfigPath = getMarketConfigPath(configRoot, resolvedMarketId);

  const parsed = await readYamlRecord(marketConfigPath, 'runtime-market-config');
  return parsed as MarketRuntimeConfig | null;
});

/**
 * Same read as `readRuntimeMarketConfig`, except a transient fs error (anything
 * other than ENOENT — e.g. a config volume mounting a moment after container
 * start, or an EMFILE/EIO burst) is re-thrown instead of swallowed to `null`.
 * Used by the market-locales resolver (Story 1.1 v1.14.0, F2), which needs to
 * tell "market.yaml genuinely absent" (deterministic, safe to cache) apart from
 * "transient I/O hiccup" (must NOT be cached — the next request should retry).
 * Deliberately NOT `react`-`cache()`-wrapped: it must run fresh every call so a
 * retry after a transient failure actually re-reads the file.
 */
export async function readRuntimeMarketConfigOrThrow(marketId: string): Promise<MarketRuntimeConfig | null> {
  const resolvedMarketId = await resolveRuntimeMarketId(marketId);
  if (!resolvedMarketId) {
    return null;
  }

  const configRoot = await resolveConfigRoot();
  const marketConfigPath = getMarketConfigPath(configRoot, resolvedMarketId);

  const parsed = await readYamlRecord(marketConfigPath, 'runtime-market-config', { rethrowTransient: true });
  return parsed as MarketRuntimeConfig | null;
}

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

function normalizeRuntimeAssetPath(value: unknown): string | null {
  const candidate = normalizeNonEmptyString(value);
  if (!candidate) {
    return null;
  }

  const normalized = candidate.replaceAll('\\', '/').replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    return null;
  }

  return segments[0] === 'assets' ? segments.join('/') : ['assets', ...segments].join('/');
}

function buildRuntimeAssetUrl(marketId: string, assetPath: string): string {
  const encodedPath = assetPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${RUNTIME_ASSET_ROUTE_BASE}/${encodeURIComponent(marketId)}/${encodedPath}`;
}

function normalizeAssetReference(value: unknown, marketId: string): string | null {
  const runtimeAssetPath = normalizeRuntimeAssetPath(value);

  return (
    normalizeHttpUrl(value) ??
    normalizeRelativePath(value) ??
    (runtimeAssetPath && marketId ? buildRuntimeAssetUrl(marketId, runtimeAssetPath) : null)
  );
}

function normalizeRuntimeAssetSegments(assetPathSegments: string[]): string[] | null {
  if (!Array.isArray(assetPathSegments) || assetPathSegments.length === 0) {
    return null;
  }

  const segments = assetPathSegments.flatMap(segment => {
    const normalized = normalizeNonEmptyString(segment)?.replaceAll('\\', '/');
    if (!normalized) {
      return [];
    }

    return normalized.split('/').filter(Boolean);
  });

  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    return null;
  }

  return segments;
}

export async function resolveRuntimeAssetFilePath(
  marketId: string,
  assetPathSegments: string[]
): Promise<string | null> {
  const normalizedMarketId = normalizeNonEmptyString(marketId);
  const normalizedSegments = normalizeRuntimeAssetSegments(assetPathSegments);

  if (!normalizedMarketId || !normalizedSegments) {
    return null;
  }

  const configRoot = await resolveConfigRoot();
  const marketRoot = getMarketRootPath(configRoot, normalizedMarketId);
  const candidatePath = path.resolve(marketRoot, ...normalizedSegments);
  const relativeToMarketRoot = path.relative(marketRoot, candidatePath);

  if (relativeToMarketRoot.startsWith('..') || path.isAbsolute(relativeToMarketRoot)) {
    return null;
  }

  return candidatePath;
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

function normalizeHomepageImage(value: unknown, marketId: string) {
  if (typeof value === 'string') {
    return normalizeAssetReference(value, marketId);
  }

  if (!isRecord(value)) {
    return null;
  }

  const url = normalizeAssetReference(value.url, marketId);
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

function normalizeStyleSectionItems(value: unknown, marketId: string) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.flatMap(item => {
    if (!isRecord(item)) {
      return [];
    }

    const label = normalizeNonEmptyString(item.label);
    const link = normalizeNonEmptyString(item.link);
    const image = normalizeHomepageImage(item.image, marketId);

    if (!label || !link) {
      return [];
    }

    return [{ label, link, image }];
  });

  return items.length > 0 ? items : null;
}

function normalizeHomepageSections(
  value: HomepageRuntimeConfig | null,
  marketId: string
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
      normalizedSection.image = normalizeHomepageImage(section.image, marketId);
    }

    if ('buttons' in section) {
      normalizedSection.buttons = normalizeHomepageButtons(section.buttons);
    }

    if ('items' in section) {
      normalizedSection.items = normalizeStyleSectionItems(section.items, marketId);
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
  const resolvedMarketId = await resolveRuntimeMarketId(marketId);
  if (!resolvedMarketId) {
    return null;
  }

  const [marketConfig, homepageConfig] = await Promise.all([
    readRuntimeMarketConfig(resolvedMarketId),
    readRuntimeHomepageConfig(resolvedMarketId)
  ]);

  if (!marketConfig && !homepageConfig) {
    return null;
  }

  const titlePattern = normalizeTitlePattern(marketConfig?.storefront?.seo_defaults?.title_pattern);

  return {
    market_id: normalizeNonEmptyString(marketConfig?.market_id) ?? resolvedMarketId,
    name: normalizeMarketName(marketConfig?.name, titlePattern, resolvedMarketId),
    logo: normalizeAssetReference(marketConfig?.storefront?.logo, resolvedMarketId),
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
    homepage_sections: normalizeHomepageSections(homepageConfig, resolvedMarketId),
    tenant: null,
    favicon: normalizeAssetReference(marketConfig?.storefront?.favicon, resolvedMarketId),
    vendor_panel_url: normalizeHttpUrl(marketConfig?.storefront?.vendor_panel_url),
    legal_entity: normalizeLegalEntity(marketConfig?.legal_entity)
  } satisfies MarketConfig;
});
