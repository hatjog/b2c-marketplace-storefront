import fs from 'node:fs/promises';
import path from 'node:path';

import * as Sentry from '@sentry/nextjs';
import yaml from 'js-yaml';
import { cache } from 'react';

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
  public_profile?: {
    social_links?: Record<string, unknown> | null;
  } | null;
  storefront?: {
    pdp_trust_signals?: string[] | null;
    default_validity_info?: string | null;
    zasady_sections?: Array<{ title: string; body: string }> | null;
  } | null;
  legal_entity?: Record<string, unknown> | null;
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

const readRuntimeMarketConfig = cache(async (marketId: string): Promise<MarketRuntimeConfig | null> => {
  if (!marketId) {
    return null;
  }

  const configRoot = await resolveConfigRoot();
  const marketConfigPath = getMarketConfigPath(configRoot, marketId);

  try {
    const raw = await fs.readFile(marketConfigPath, 'utf8');
    const parsed = yaml.load(raw);

    return isRecord(parsed) ? (parsed as MarketRuntimeConfig) : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null;
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(`[runtime-market-config] failed to load ${marketConfigPath}`);
    }

    console.error(`[runtime-market-config] failed to load ${marketConfigPath}`, error);
    return null;
  }
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
  if (!Array.isArray(sections) || sections.length === 0) return null;
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
