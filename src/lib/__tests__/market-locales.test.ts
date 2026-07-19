import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { narrowMarketLocales } from '../market-locales';

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

async function createConfigRoot(marketYaml: string | null): Promise<string> {
  const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-market-locales-'));
  const marketRoot = path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty');
  await fs.mkdir(marketRoot, { recursive: true });
  if (marketYaml !== null) {
    await fs.writeFile(path.join(marketRoot, 'market.yaml'), marketYaml, 'utf8');
  }
  return configRoot;
}

async function importFreshResolver(configRoot: string) {
  vi.stubEnv('GP_CONFIG_ROOT', configRoot);
  vi.stubEnv('GP_INSTANCE_ID', 'gp-dev');
  vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', 'bonbeauty');
  vi.resetModules();
  return import('../market-locales');
}

describe('narrowMarketLocales (pure narrowing, AC1)', () => {
  it('narrows a valid locales block to supported + defaultLocale', () => {
    const result = narrowMarketLocales(
      { default: 'pl', supported: ['pl', 'en', 'ua', 'de'], fallback_chain: ['pl', 'en'] },
      'bonbeauty'
    );
    expect(result.supported).toEqual(['pl', 'en', 'ua', 'de']);
    expect(result.defaultLocale).toBe('pl');
  });

  it('takes default EXCLUSIVELY from locales.default — not supported[0]', () => {
    const result = narrowMarketLocales({ default: 'en', supported: ['pl', 'en'] }, 'bonbeauty');
    expect(result.defaultLocale).toBe('en');
  });

  it('fails fast when the locales block is missing (no silent superset fallback)', () => {
    expect(() => narrowMarketLocales(undefined, 'bonbeauty')).toThrowError(
      /market "bonbeauty": locales block is missing/
    );
  });

  it('fails fast on a supported entry outside the platform superset (ADR-150-4)', () => {
    expect(() =>
      narrowMarketLocales({ default: 'pl', supported: ['pl', 'fr'] }, 'bonbeauty')
    ).toThrowError(/locales\.supported contains "fr" outside the platform superset/);
  });

  it('fails fast when default is outside the platform superset', () => {
    expect(() =>
      narrowMarketLocales({ default: 'fr', supported: ['pl'] }, 'bonbeauty')
    ).toThrowError(/locales\.default is "fr"/);
  });

  it('fails fast when default is not a member of supported', () => {
    expect(() =>
      narrowMarketLocales({ default: 'de', supported: ['pl', 'en'] }, 'bonbeauty')
    ).toThrowError(/locales\.default "de" is not a member of locales\.supported/);
  });

  it('fails fast when supported or default is absent inside locales', () => {
    expect(() => narrowMarketLocales({ default: 'pl' }, 'bonbeauty')).toThrowError(
      /locales\.supported is missing/
    );
    expect(() => narrowMarketLocales({ supported: ['pl'] }, 'bonbeauty')).toThrowError(
      /locales\.default is missing/
    );
  });

  it('rejects unknown keys inside locales (schema additionalProperties: false)', () => {
    expect(() =>
      narrowMarketLocales({ default: 'pl', supported: ['pl'], extra: true }, 'bonbeauty')
    ).toThrowError(/unknown key\(s\) \[extra\]/);
  });

  it('rejects fallback_chain entries outside supported', () => {
    expect(() =>
      narrowMarketLocales(
        { default: 'pl', supported: ['pl'], fallback_chain: ['pl', 'en'] },
        'bonbeauty'
      )
    ).toThrowError(/locales\.fallback_chain contains "en"/);
  });
});

describe('resolveMarketLocales (MarketRuntimeConfig read + module cache, AC1)', () => {
  it('reads supported/default from the market.yaml locales block', async () => {
    const configRoot = await createConfigRoot(
      ['market_id: bonbeauty', 'locales:', '  default: en', '  supported: [pl, en, ua]', ''].join(
        '\n'
      )
    );
    const { resolveMarketLocales } = await importFreshResolver(configRoot);

    const result = await resolveMarketLocales();
    expect(result.supported).toEqual(['pl', 'en', 'ua']);
    expect(result.defaultLocale).toBe('en');
  });

  it('caches at module level — a config change is NOT picked up without restart (AD-2)', async () => {
    const configRoot = await createConfigRoot(
      ['market_id: bonbeauty', 'locales:', '  default: pl', '  supported: [pl, en]', ''].join('\n')
    );
    const { resolveMarketLocales } = await importFreshResolver(configRoot);

    const first = await resolveMarketLocales();
    expect(first.supported).toEqual(['pl', 'en']);

    await fs.writeFile(
      path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty', 'market.yaml'),
      ['market_id: bonbeauty', 'locales:', '  default: pl', '  supported: [pl]', ''].join('\n'),
      'utf8'
    );

    const second = await resolveMarketLocales();
    expect(second.supported).toEqual(['pl', 'en']);
    expect(second).toBe(first);
  });

  it('fails fast when market.yaml has no locales block', async () => {
    const configRoot = await createConfigRoot('market_id: bonbeauty\nname: BonBeauty\n');
    const { resolveMarketLocales } = await importFreshResolver(configRoot);

    await expect(resolveMarketLocales()).rejects.toThrowError(
      /market "bonbeauty": locales block is missing/
    );
  });

  it('fails fast when market.yaml is absent entirely', async () => {
    const configRoot = await createConfigRoot(null);
    const { resolveMarketLocales } = await importFreshResolver(configRoot);

    await expect(resolveMarketLocales()).rejects.toThrowError(/market-locales/);
  });

  it('does NOT cache a transient fs error (F2) — a retry after the hiccup clears succeeds', async () => {
    const configRoot = await createConfigRoot(null);
    const marketYamlPath = path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty', 'market.yaml');
    // Simulate a transient I/O hiccup (not ENOENT): market.yaml is momentarily a
    // directory (e.g. a config volume mid-mount), so fs.readFile throws EISDIR.
    await fs.mkdir(marketYamlPath, { recursive: true });

    const { resolveMarketLocales } = await importFreshResolver(configRoot);

    await expect(resolveMarketLocales()).rejects.toThrow();

    // Fix the transient condition: replace the directory with the real file.
    await fs.rm(marketYamlPath, { recursive: true, force: true });
    await fs.writeFile(
      marketYamlPath,
      ['market_id: bonbeauty', 'locales:', '  default: pl', '  supported: [pl, en]', ''].join('\n'),
      'utf8'
    );

    // The rejection must NOT have been cached — the next call retries and reads
    // the now-valid config, instead of permanently failing until restart.
    const result = await resolveMarketLocales();
    expect(result.supported).toEqual(['pl', 'en']);
    expect(result.defaultLocale).toBe('pl');
  });

  it('DOES cache a deterministic validation error (missing locales block) — no retry', async () => {
    const configRoot = await createConfigRoot('market_id: bonbeauty\nname: BonBeauty\n');
    const { resolveMarketLocales } = await importFreshResolver(configRoot);

    await expect(resolveMarketLocales()).rejects.toThrowError(
      /market "bonbeauty": locales block is missing/
    );

    // Fix the config on disk — a cached validation-error rejection must still
    // be returned (module-level cache, AD-2: restart required to pick up fixes).
    await fs.writeFile(
      path.join(configRoot, 'gp-dev', 'markets', 'bonbeauty', 'market.yaml'),
      ['market_id: bonbeauty', 'locales:', '  default: pl', '  supported: [pl]', ''].join('\n'),
      'utf8'
    );

    await expect(resolveMarketLocales()).rejects.toThrowError(
      /market "bonbeauty": locales block is missing/
    );
  });

  it('isMarketSupportedLocale / getMarketDefaultLocale follow the resolver contract', async () => {
    const configRoot = await createConfigRoot(
      ['market_id: bonbeauty', 'locales:', '  default: pl', '  supported: [pl, ua]', ''].join('\n')
    );
    const { isMarketSupportedLocale, getMarketDefaultLocale } =
      await importFreshResolver(configRoot);

    await expect(isMarketSupportedLocale('ua')).resolves.toBe(true);
    await expect(isMarketSupportedLocale('de')).resolves.toBe(false);
    await expect(getMarketDefaultLocale()).resolves.toBe('pl');
  });
});
