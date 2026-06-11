import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeZasadySection } from '../runtime-market-config';

const ORIGINAL_ENV = {
  GP_CONFIG_ROOT: process.env.GP_CONFIG_ROOT,
  GP_INSTANCE_ID: process.env.GP_INSTANCE_ID,
  NEXT_PUBLIC_PAYLOAD_MARKET_ID: process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function createRuntimeMarketConfig(theme: string | null) {
  const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-runtime-market-config-'));
  const marketRoot = path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty');
  await fs.mkdir(marketRoot, { recursive: true });
  await fs.writeFile(
    path.join(marketRoot, 'market.yaml'),
    [
      'market_id: bonbeauty',
      'name: BonBeauty',
      'storefront:',
      theme ? `  theme: ${theme}` : '  primary_color: "#111111"',
      ''
    ].join('\n'),
    'utf8'
  );

  return configRoot;
}

describe('resolveRuntimePortalMarketConfig', () => {
  it('resolves BonBeauty theme from runtime YAML when market id is empty', async () => {
    const configRoot = await createRuntimeMarketConfig('bonbeauty');
    vi.stubEnv('GP_CONFIG_ROOT', configRoot);
    vi.stubEnv('GP_INSTANCE_ID', 'gp-dev');
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', '');
    vi.resetModules();

    const { resolveRuntimePortalMarketConfig } = await import('../runtime-market-config');

    const firstResult = await resolveRuntimePortalMarketConfig('');
    const secondResult = await resolveRuntimePortalMarketConfig('');

    expect(firstResult?.market_id).toBe('bonbeauty');
    expect(firstResult?.theme).toBe('bonbeauty');
    expect(secondResult?.theme).toBe('bonbeauty');
  });

  it('resolves market id but returns null theme when market YAML has no storefront.theme', async () => {
    // Covers the firstConfiguredMarket fallback branch in discoverRuntimeMarketId
    // (market exists but has no theme → market_id resolved, theme null).
    const configRoot = await createRuntimeMarketConfig(null);
    vi.stubEnv('GP_CONFIG_ROOT', configRoot);
    vi.stubEnv('GP_INSTANCE_ID', 'gp-dev');
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', '');
    vi.resetModules();

    const { resolveRuntimePortalMarketConfig } = await import('../runtime-market-config');

    const result = await resolveRuntimePortalMarketConfig('');

    expect(result).not.toBeNull();
    expect(result?.market_id).toBe('bonbeauty');
    expect(result?.theme).toBeNull();
  });

  it('returns null for empty market id when runtime YAML is absent', async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-runtime-market-config-empty-'));
    vi.stubEnv('GP_CONFIG_ROOT', configRoot);
    vi.stubEnv('GP_INSTANCE_ID', 'gp-dev');
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', '');
    vi.resetModules();

    const { resolveRuntimePortalMarketConfig } = await import('../runtime-market-config');

    await expect(resolveRuntimePortalMarketConfig('')).resolves.toBeNull();
  });

  it('keeps Payload as secondary fetch when empty market id resolves from runtime YAML', async () => {
    const configRoot = await createRuntimeMarketConfig('bonbeauty');
    vi.stubEnv('GP_CONFIG_ROOT', configRoot);
    vi.stubEnv('GP_INSTANCE_ID', 'gp-dev');
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', '');
    vi.resetModules();

    const fetchMock = vi.fn(async () => {
      throw new Error('Payload should not be called when runtime YAML resolves theme');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveMarketConfig } = await import('../portal.server');

    const result = await resolveMarketConfig('');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.usedFallback).toBe(false);
    expect(result.marketConfig.theme).toBe('bonbeauty');
  });
});

describe('normalizeZasadySection', () => {
  it('returns null for null input', () => {
    expect(normalizeZasadySection(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeZasadySection(undefined)).toBeNull();
  });

  it('returns null for string input', () => {
    expect(normalizeZasadySection('hello')).toBeNull();
  });

  it('returns null for number input', () => {
    expect(normalizeZasadySection(42)).toBeNull();
  });

  it('returns null for array input', () => {
    expect(normalizeZasadySection([])).toBeNull();
  });

  it('returns null when title is missing', () => {
    expect(normalizeZasadySection({ body: 'Some body' })).toBeNull();
  });

  it('returns null when body is missing', () => {
    expect(normalizeZasadySection({ title: 'Title' })).toBeNull();
  });

  it('returns null when title is empty string', () => {
    expect(normalizeZasadySection({ title: '', body: 'Body' })).toBeNull();
  });

  it('returns null when title is whitespace only', () => {
    expect(normalizeZasadySection({ title: '   ', body: 'Body' })).toBeNull();
  });

  it('returns null when body is empty string', () => {
    expect(normalizeZasadySection({ title: 'Title', body: '' })).toBeNull();
  });

  it('returns null when body is whitespace only', () => {
    expect(normalizeZasadySection({ title: 'Title', body: '   ' })).toBeNull();
  });

  it('returns null when title is null', () => {
    expect(normalizeZasadySection({ title: null, body: 'Body' })).toBeNull();
  });

  it('returns null when body is null', () => {
    expect(normalizeZasadySection({ title: 'Title', body: null })).toBeNull();
  });

  it('returns normalized section for valid input', () => {
    const result = normalizeZasadySection({ title: 'Zwroty', body: '<p>14 dni na zwrot</p>' });
    expect(result).toEqual({ title: 'Zwroty', body: '<p>14 dni na zwrot</p>' });
  });

  it('trims whitespace from title', () => {
    const result = normalizeZasadySection({ title: '  Reklamacje  ', body: 'Treść' });
    expect(result?.title).toBe('Reklamacje');
  });

  it('trims whitespace from body', () => {
    const result = normalizeZasadySection({ title: 'Tytuł', body: '  Treść  ' });
    expect(result?.body).toBe('Treść');
  });

  it('ignores extra properties (no leakage)', () => {
    const result = normalizeZasadySection({ title: 'T', body: 'B', extra: 'data' });
    expect(result).toEqual({ title: 'T', body: 'B' });
    expect(result).not.toHaveProperty('extra');
  });
});
