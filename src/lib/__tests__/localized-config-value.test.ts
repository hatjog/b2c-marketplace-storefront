import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isLocalizedConfigValue,
  resolveLocalizedConfigValue,
} from '../i18n/localized-config-value';

// QD-01: the locale set is a fixture INPUT, never a hard-coded expectation list.
// Every assertion below is derived from `SUPPORTED`/`DEFAULT`, so a market whose
// `market.locales` change would move this test with it instead of around it.
const SUPPORTED = ['pl', 'en', 'ua', 'de'] as const;
const DEFAULT = 'pl' as const;

function options(locale: (typeof SUPPORTED)[number], fieldPath = 'sections.hero.heading') {
  return { locale, defaultLocale: DEFAULT, supported: SUPPORTED, fieldPath };
}

const FULL_MAP = Object.fromEntries(SUPPORTED.map(locale => [locale, `heading-${locale}`]));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isLocalizedConfigValue', () => {
  it('recognises a map that carries at least one supported locale key', () => {
    expect(isLocalizedConfigValue({ pl: 'a' }, SUPPORTED)).toBe(true);
  });

  it('rejects scalars, arrays and maps with no supported key', () => {
    expect(isLocalizedConfigValue('a', SUPPORTED)).toBe(false);
    expect(isLocalizedConfigValue(['pl'], SUPPORTED)).toBe(false);
    expect(isLocalizedConfigValue({ cs: 'a' }, SUPPORTED)).toBe(false);
  });
});

describe('resolveLocalizedConfigValue — full coverage', () => {
  it.each(SUPPORTED)('returns the %s variant without borrowing another locale', locale => {
    const resolved = resolveLocalizedConfigValue(FULL_MAP, options(locale));

    expect(resolved).toEqual({
      value: `heading-${locale}`,
      locale,
      isFallback: false,
      fromLegacyScalar: false,
    });
  });

  it('never returns a value belonging to a different locale', () => {
    const seen = SUPPORTED.map(locale => resolveLocalizedConfigValue(FULL_MAP, options(locale))?.value);

    expect(new Set(seen).size).toBe(SUPPORTED.length);
  });
});

describe('resolveLocalizedConfigValue — fallback policy', () => {
  it('falls back to the market default and reports it', () => {
    const resolved = resolveLocalizedConfigValue({ [DEFAULT]: 'tylko po polsku' }, options('ua'));

    expect(resolved).toEqual({
      value: 'tylko po polsku',
      locale: DEFAULT,
      isFallback: true,
      fromLegacyScalar: false,
    });
  });

  it('does not mark the default locale itself as a fallback', () => {
    const resolved = resolveLocalizedConfigValue({ [DEFAULT]: 'po polsku' }, options(DEFAULT));

    expect(resolved?.isFallback).toBe(false);
  });

  it('treats a blank variant as missing and falls back', () => {
    const resolved = resolveLocalizedConfigValue({ [DEFAULT]: 'po polsku', ua: '   ' }, options('ua'));

    expect(resolved?.locale).toBe(DEFAULT);
    expect(resolved?.isFallback).toBe(true);
  });

  it('never chains beyond the market default', () => {
    // `en` exists, `pl` (default) does not: there is no en → ua hop.
    const resolved = resolveLocalizedConfigValue({ en: 'english only' }, options('ua'));

    expect(resolved).toBeNull();
  });

  it('returns null for an absent field', () => {
    expect(resolveLocalizedConfigValue(undefined, options('ua'))).toBeNull();
    expect(resolveLocalizedConfigValue(null, options('ua'))).toBeNull();
  });
});

describe('resolveLocalizedConfigValue — legacy scalar migration shim', () => {
  it('reads a scalar as the market default and warns with the field path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolved = resolveLocalizedConfigValue('Odkryj piękno', options('de', 'sections.hero.paragraph'));

    expect(resolved).toEqual({
      value: 'Odkryj piękno',
      locale: DEFAULT,
      isFallback: true,
      fromLegacyScalar: true,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('sections.hero.paragraph');
  });

  it('is not a fallback when the route locale IS the market default', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolved = resolveLocalizedConfigValue('Odkryj piękno', options(DEFAULT));

    expect(resolved?.isFallback).toBe(false);
    expect(resolved?.fromLegacyScalar).toBe(true);
  });

  it('treats a blank scalar as missing', () => {
    expect(resolveLocalizedConfigValue('   ', options('ua'))).toBeNull();
  });
});

describe('resolveLocalizedConfigValue — fail-loud on illegal shape', () => {
  it('throws on a non-string locale entry', () => {
    expect(() => resolveLocalizedConfigValue({ pl: 42 }, options('pl'))).toThrow(
      /sections\.hero\.heading\.pl: locale entries must be strings/
    );
  });

  it('throws on an empty map', () => {
    expect(() => resolveLocalizedConfigValue({}, options('pl'))).toThrow(/empty locale map/);
  });

  it('throws on an array', () => {
    expect(() => resolveLocalizedConfigValue(['pl'], options('pl'))).toThrow(/expected a locale map/);
  });

  it('throws when no key belongs to the market locale set', () => {
    expect(() => resolveLocalizedConfigValue({ cs: 'ahoj' }, options('pl'))).toThrow(
      /no key from market\.locales\.supported/
    );
  });

  it('accepts a narrower market: a single-locale market resolves its only key', () => {
    const resolved = resolveLocalizedConfigValue(FULL_MAP, {
      locale: 'en',
      defaultLocale: 'en',
      supported: ['en'],
      fieldPath: 'sections.hero.heading',
    });

    expect(resolved).toEqual({
      value: 'heading-en',
      locale: 'en',
      isFallback: false,
      fromLegacyScalar: false,
    });
  });
});
