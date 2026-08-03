import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MARKET_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export type SlugRedirectEntry = {
  from: string;
  to: string;
  permanent: boolean;
};

export type NextRedirectEntry = {
  source: string;
  destination: string;
  permanent: boolean;
};

type SlugRedirectConfig = {
  redirects?: SlugRedirectEntry[] | null;
};

function resolveConfigRoot(configRoot?: string): string {
  const resolved = path.resolve(configRoot ?? process.env.GP_CONFIG_ROOT ?? path.resolve(process.cwd(), '../config'));
  if (path.basename(resolved) === 'gp-dev' || fs.existsSync(path.join(resolved, 'markets'))) {
    return resolved;
  }
  return path.join(resolved, 'gp-dev');
}

function validateMarketId(marketId: string): void {
  if (!MARKET_RE.test(marketId)) {
    throw new Error(`Invalid market_id: ${marketId}`);
  }
}

function validateEntry(entry: unknown, index: number): SlugRedirectEntry {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`redirects[${index}] must be an object`);
  }

  const candidate = entry as Record<string, unknown>;
  if (typeof candidate.from !== 'string' || !SLUG_RE.test(candidate.from)) {
    throw new Error(`redirects[${index}].from must be a lowercase slug`);
  }
  if (typeof candidate.to !== 'string' || !SLUG_RE.test(candidate.to)) {
    throw new Error(`redirects[${index}].to must be a lowercase slug`);
  }
  if (typeof candidate.permanent !== 'boolean') {
    throw new Error(`redirects[${index}].permanent must be boolean`);
  }

  return {
    from: candidate.from,
    to: candidate.to,
    permanent: candidate.permanent,
  };
}

export function loadSlugRedirectsForNext(
  marketId: string = process.env.GP_MARKET_ID ?? process.env.MARKET_ID ?? 'bonbeauty',
  configRoot?: string,
): NextRedirectEntry[] {
  validateMarketId(marketId);

  const root = resolveConfigRoot(configRoot);
  const filePath = path.join(root, 'markets', marketId, 'slug-redirects.yaml');

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = yaml.load(raw, { schema: yaml.JSON_SCHEMA }) as SlugRedirectConfig | null | undefined;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid slug-redirects.yaml for market_id=${marketId}: not an object`);
  }

  const rawEntries = parsed.redirects;
  if (rawEntries == null) {
    return [];
  }
  if (!Array.isArray(rawEntries)) {
    throw new Error(`Invalid slug-redirects.yaml for market_id=${marketId}: redirects must be an array or null`);
  }

  const deduped = new Map<string, SlugRedirectEntry>();
  rawEntries.forEach((entry, index) => {
    const validEntry = validateEntry(entry, index);
    deduped.set(validEntry.from, validEntry);
  });

  return Array.from(deduped.values()).map((entry) => ({
    source: `/:locale/products/${entry.from}`,
    destination: `/:locale/products/${entry.to}`,
    permanent: entry.permanent,
  }));
}