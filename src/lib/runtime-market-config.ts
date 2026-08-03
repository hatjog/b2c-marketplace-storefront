// Guardrail: this module reads the filesystem (`node:fs`) and must never be
// bundled into a client component. If a barrel or import chain ever pulls it
// client-side again, this fails the build with a clear message instead of the
// cryptic `UnhandledSchemeError: Reading from "node:fs/promises"` (v1.14.0).
import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import * as Sentry from '@sentry/nextjs';
import yaml from 'js-yaml';
import { cache } from 'react';

import type { SupportedLocale } from '@/i18n/routing';
import type { LocalizedConfigValue } from '@/lib/i18n/localized-config-value';
import { resolveLocalizedConfigValue } from '@/lib/i18n/localized-config-value';
import type { MarketConfig } from '@/lib/portal';

const RUNTIME_ASSET_ROUTE_BASE = '/api/runtime-market-assets';

/**
 * QD-01/QD-02 — the effective locale set for one market, as produced by the
 * ADR-154 resolver (`src/lib/market-locales.ts`). It is passed IN rather than
 * imported so this module keeps a single direction of dependency (market-locales
 * reads the runtime config, not the other way round) and so no caller can skip
 * it. Named for the contract, not for one surface: homepage and footer share it.
 */
export type MarketLocaleContext = {
  supported: readonly SupportedLocale[];
  defaultLocale: SupportedLocale;
};

/**
 * User-facing fields on a homepage section. Every one of them is a locale map in
 * source. CONTRACT: must stay in sync with HOMEPAGE_TRANSLATABLE_FIELDS in
 * gp-ops/cli/src/config-load.ts and _grow/tools/validate_gp_runtime_config.py.
 */
const TRANSLATABLE_SECTION_FIELDS = ['heading', 'paragraph', 'subheading', 'label'] as const;

/** Repeatable children whose `label` is user-facing (hero buttons, style items). */
const TRANSLATABLE_LIST_FIELDS = ['buttons', 'items'] as const;

/**
 * Marker attached to a section whose copy had to fall back to the market default
 * locale. The renderer uses it to label the fragment (`lang` + visible notice);
 * `null` means "fully in the requested locale".
 */
export type SectionLocaleFallback = {
  /** Locale the fallen-back copy came from (always `market.locales.default`). */
  locale: SupportedLocale;
  /** Dotted paths of the fields that fell back. */
  fields: string[];
  /**
   * True when EVERY translatable field of the section fell back.
   *
   * Only then may the renderer put `lang` on the whole section: with a partial
   * fallback the section still contains correctly translated siblings, and
   * labelling them with the fallback language would be a different lie than the
   * one this package removes. The notice is shown either way — see
   * `LocaleFallbackFragment`.
   */
  whole: boolean;
};

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

// Mirrors `properties.content_gate` of market-runtime-config.v1.schema.json
// (AD-4 / ADR-164): key set is drift-tested against the schema (Story 1.4
// v1.14.0, AC3 parity). Brak bloku ⇒ FAZA 1 dla każdego locale.
export type MarketContentGateRuntimeBlock = {
  phase_2_locales?: unknown;
};

export type MarketRuntimeConfig = {
  market_id?: string | null;
  name?: string | null;
  locales?: MarketLocalesRuntimeBlock | null;
  content_gate?: MarketContentGateRuntimeBlock | null;
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

    const href = normalizeRelativePath(item.href) ?? normalizeRelativePath(item.url);
    const enabled = typeof item.enabled === 'boolean' ? item.enabled : null;

    // QD-02: a link is a ROUTE. Its label is chrome resolved from the canonical
    // route contract (`src/lib/footer.ts`), so a missing label no longer drops
    // the link — only a missing route does.
    if (!href) {
      return [];
    }

    return [{ href, enabled }];
  });

  return links.length > 0 ? links : null;
}

function normalizeFooter(value: unknown): MarketConfig['footer'] | null {
  if (!isRecord(value)) {
    return null;
  }

  // QD-02 / QD-01 lesson: the LOADER hands back the raw locale map. Flattening
  // here would destroy every non-default variant for all future consumers; the
  // single resolution boundary is `resolveMarketConfig` (see
  // `resolveFooterLocalizedCopy`). `normalizeNonEmptyString` used to live here
  // and silently turned a locale map into `null`, which nulled the whole footer.
  const copyright = isRecord(value.copyright)
    ? (value.copyright as LocalizedConfigValue)
    : normalizeNonEmptyString(value.copyright);
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

/**
 * QD-02 — the single boundary where a footer locale map becomes a string.
 *
 * It runs in `resolveMarketConfig`, not in `normalizeFooter`, on purpose:
 * `resolveMarketConfig` has TWO sources (runtime YAML and the Payload API
 * fallback) and only this point sees both. Resolving inside the YAML loader
 * would leave the Payload path handing a raw Polish scalar straight to the
 * renderer — a mechanism that is green in tests and dead on the real path.
 *
 * `copyright` is a single field in a single `<p>`, so a fallback is always a
 * WHOLE-fragment fallback and stamping `lang` on it is honest. That is why this
 * returns `whole: true` unconditionally rather than pretending to compute it —
 * see the QD-01 change log for what partial fallbacks cost.
 */
export function resolveFooterLocalizedCopy(
  footer: MarketConfig['footer'],
  options: {
    locale: SupportedLocale;
    marketLocales: MarketLocaleContext;
    marketId: string;
  }
): MarketConfig['footer'] {
  if (!footer) {
    return footer;
  }

  const resolved = resolveLocalizedConfigValue(footer.copyright, {
    locale: options.locale,
    defaultLocale: options.marketLocales.defaultLocale,
    supported: options.marketLocales.supported,
    fieldPath: `markets.${options.marketId}.storefront.footer.copyright`
  });

  return {
    ...footer,
    copyright: resolved?.value ?? null,
    copyright_fallback:
      resolved && resolved.isFallback
        ? { locale: resolved.locale, whole: true, fromLegacyScalar: resolved.fromLegacyScalar }
        : null
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

/**
 * Collects fallbacks for one section while resolving it. One accumulator per
 * section keeps the notice attached to the fragment that actually fell back
 * (party review PR-2) instead of flagging the whole page.
 */
type FallbackAccumulator = {
  locale: SupportedLocale | null;
  fields: string[];
  /** Fields that resolved in the requested locale — needed to tell partial from whole. */
  resolvedInRequestedLocale: number;
};

function resolveSectionText(
  raw: unknown,
  fieldPath: string,
  locales: MarketLocaleContext,
  requestedLocale: SupportedLocale,
  accumulator: FallbackAccumulator
): string | null {
  const resolved = resolveLocalizedConfigValue(raw, {
    locale: requestedLocale,
    defaultLocale: locales.defaultLocale,
    supported: locales.supported,
    fieldPath
  });

  if (!resolved) {
    return null;
  }

  if (resolved.isFallback) {
    accumulator.locale = resolved.locale;
    accumulator.fields.push(fieldPath);
  } else {
    accumulator.resolvedInRequestedLocale += 1;
  }

  return resolved.value;
}

function normalizeHomepageButtons(
  value: unknown,
  sectionPath: string,
  locales: MarketLocaleContext,
  requestedLocale: SupportedLocale,
  accumulator: FallbackAccumulator
) {
  if (!Array.isArray(value)) {
    return null;
  }

  const buttons = value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    const label = resolveSectionText(
      item.label,
      `${sectionPath}.buttons[${index}].label`,
      locales,
      requestedLocale,
      accumulator
    );
    const path = normalizeNonEmptyString(item.path) ?? normalizeNonEmptyString(item.url);
    const variant = normalizeNonEmptyString(item.variant);

    if (!label || !path) {
      return [];
    }

    return [{ label, path, variant }];
  });

  return buttons.length > 0 ? buttons : null;
}

function normalizeStyleSectionItems(
  value: unknown,
  marketId: string,
  sectionPath: string,
  locales: MarketLocaleContext,
  requestedLocale: SupportedLocale,
  accumulator: FallbackAccumulator
) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    const label = resolveSectionText(
      item.label,
      `${sectionPath}.items[${index}].label`,
      locales,
      requestedLocale,
      accumulator
    );
    const link = normalizeNonEmptyString(item.link);
    const image = normalizeHomepageImage(item.image, marketId);

    if (!label || !link) {
      return [];
    }

    return [{ label, link, image }];
  });

  return items.length > 0 ? items : null;
}

/**
 * QD-01: resolves market copy for ONE explicit locale.
 *
 * This is the only boundary through which homepage sections reach the renderer,
 * which is why locale resolution lives here and not in the blocks: a locale map
 * has no path by which it can leak into JSX and render as `[object Object]`.
 * Blocks keep receiving plain strings and need no changes.
 */
export function normalizeHomepageSections(
  value: HomepageRuntimeConfig | null,
  marketId: string,
  locale: SupportedLocale,
  locales: MarketLocaleContext
): MarketConfig['homepage_sections'] | null {
  if (!isRecord(value?.sections)) {
    return null;
  }

  const blocks = Object.entries(value.sections).flatMap(([blockType, section]) => {
    if (!isRecord(section)) {
      return [];
    }

    const accumulator: FallbackAccumulator = {
      locale: null,
      fields: [],
      resolvedInRequestedLocale: 0
    };
    const sectionPath = `sections.${blockType}`;

    const normalizedSection: Record<string, unknown> = {
      id: blockType,
      blockType,
      ...section
    };

    for (const field of TRANSLATABLE_SECTION_FIELDS) {
      if (!(field in section)) continue;
      normalizedSection[field] = resolveSectionText(
        section[field],
        `${sectionPath}.${field}`,
        locales,
        locale,
        accumulator
      );
    }

    if ('image' in section) {
      normalizedSection.image = normalizeHomepageImage(section.image, marketId);
    }

    if ('buttons' in section) {
      normalizedSection.buttons = normalizeHomepageButtons(
        section.buttons,
        sectionPath,
        locales,
        locale,
        accumulator
      );
    }

    if ('items' in section) {
      normalizedSection.items = normalizeStyleSectionItems(
        section.items,
        marketId,
        sectionPath,
        locales,
        locale,
        accumulator
      );
    }

    // Belt and braces: TRANSLATABLE_LIST_FIELDS documents which repeatables carry
    // user-facing labels, so a new one added to the config contract without a
    // resolver here fails loudly instead of rendering a raw map.
    for (const listField of TRANSLATABLE_LIST_FIELDS) {
      const list = normalizedSection[listField];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (isRecord(item) && isRecord(item.label)) {
          throw new Error(
            `[runtime-market-config] ${sectionPath}.${listField}: unresolved locale map reached the renderer`
          );
        }
      }
    }

    normalizedSection.locale_fallback = accumulator.locale
      ? ({
          locale: accumulator.locale,
          fields: accumulator.fields,
          whole: accumulator.resolvedInRequestedLocale === 0
        } satisfies SectionLocaleFallback)
      : null;

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

/**
 * QD-01: homepage SEO copy for one explicit locale.
 *
 * `homepage.yaml` owns market-authored metadata; `messages/*.json` stays the
 * generic default for markets that author none. Keeping the read here (rather
 * than leaving the `seo:` block unread, as it was before this package) means the
 * localized values are actually rendered somewhere instead of being four
 * translations of a dead field.
 */
export const resolveRuntimeHomepageSeo = cache(async (
  marketId: string,
  locale: SupportedLocale,
  locales: MarketLocaleContext
): Promise<{ meta_title: string | null; meta_description: string | null }> => {
  const resolvedMarketId = await resolveRuntimeMarketId(marketId);
  if (!resolvedMarketId) {
    return { meta_title: null, meta_description: null };
  }

  const homepageConfig = await readRuntimeHomepageConfig(resolvedMarketId);
  const seo = (homepageConfig as Record<string, unknown> | null)?.seo;
  if (!isRecord(seo)) {
    return { meta_title: null, meta_description: null };
  }

  const resolve = (field: 'meta_title' | 'meta_description') =>
    resolveLocalizedConfigValue(seo[field], {
      locale,
      defaultLocale: locales.defaultLocale,
      supported: locales.supported,
      fieldPath: `seo.${field}`
    })?.value ?? null;

  return { meta_title: resolve('meta_title'), meta_description: resolve('meta_description') };
});

/**
 * QD-01: `locale` is a REQUIRED argument. Market copy cannot be resolved without
 * naming a locale, so the type system — not a review checklist — guarantees every
 * call site supplies one. `locale` is part of the `cache()` key, satisfying
 * decision 5 (locale belongs in every cache key for localized data).
 */
export const resolveRuntimePortalMarketConfig = cache(async (
  marketId: string,
  locale: SupportedLocale,
  locales: MarketLocaleContext
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
    homepage_sections: normalizeHomepageSections(homepageConfig, resolvedMarketId, locale, locales),
    tenant: null,
    favicon: normalizeAssetReference(marketConfig?.storefront?.favicon, resolvedMarketId),
    vendor_panel_url: normalizeHttpUrl(marketConfig?.storefront?.vendor_panel_url),
    legal_entity: normalizeLegalEntity(marketConfig?.legal_entity)
  } satisfies MarketConfig;
});
