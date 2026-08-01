/**
 * QD-01 acceptance proof (SPEC-storefront-i18n-completeness).
 *
 * Runs against the REAL assembled runtime config in `GP/config/gp-dev`, not a
 * hand-written fixture: a migration that only satisfies a fixture would be the
 * exact "mechanism exists but is dead on the real path" failure this package is
 * meant to close. The locale set under test is read from that market's own
 * `market.yaml`, so this file keeps no competing list of locales.
 */

import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { normalizeHomepageSections } from '../runtime-market-config';

const CONFIG_ROOT = path.resolve(__dirname, '../../../../config/gp-dev/markets');

type Locales = { default: string; supported: string[] };

function readMarket(marketId: string) {
  const read = (file: string) =>
    yaml.load(fs.readFileSync(path.join(CONFIG_ROOT, marketId, file), 'utf8')) as any;

  const market = read('market.yaml');
  return {
    homepage: read('homepage.yaml'),
    locales: market.locales as Locales,
  };
}

function context(locales: Locales) {
  return { supported: locales.supported as any, defaultLocale: locales.default as any };
}

function section(sections: unknown[] | null | undefined, blockType: string): any {
  return (sections ?? []).find((entry: any) => entry?.blockType === blockType);
}

describe('AC1 — every active locale renders its own market copy', () => {
  const { homepage, locales } = readMarket('bonbeauty');

  it('exercises a genuinely multilingual market', () => {
    expect(locales.supported.length).toBeGreaterThan(1);
  });

  it.each(locales.supported)('resolves BonBeauty homepage for %s', locale => {
    const sections = normalizeHomepageSections(
      structuredClone(homepage),
      'bonbeauty',
      locale as any,
      context(locales)
    );

    const hero = section(sections, 'hero');
    const banner = section(sections, 'banner');
    const style = section(sections, 'style_section');

    expect(hero.heading).toBe(homepage.sections.hero.heading[locale]);
    expect(hero.paragraph).toBe(homepage.sections.hero.paragraph[locale]);
    expect(hero.buttons[0].label).toBe(homepage.sections.hero.buttons[0].label[locale]);
    expect(banner.label).toBe(homepage.sections.banner.label[locale]);
    expect(style.items[0].label).toBe(homepage.sections.style_section.items[0].label[locale]);

    // No borrowed copy from any other active locale.
    for (const other of locales.supported) {
      if (other === locale) continue;
      expect(hero.heading).not.toBe(homepage.sections.hero.heading[other]);
    }

    // Full coverage ⇒ nothing is flagged as a fallback.
    for (const entry of sections ?? []) {
      expect((entry as any).locale_fallback).toBeNull();
    }
  });

  it('yields a distinct heading per locale (no silent collapse to one language)', () => {
    const headings = locales.supported.map(
      locale =>
        section(
          normalizeHomepageSections(structuredClone(homepage), 'bonbeauty', locale as any, context(locales)),
          'hero'
        ).heading
    );

    expect(new Set(headings).size).toBe(locales.supported.length);
  });

  it('resolves a single-locale market through the same path', () => {
    const mercur = readMarket('mercur');
    const sections = normalizeHomepageSections(
      structuredClone(mercur.homepage),
      'mercur',
      mercur.locales.default as any,
      context(mercur.locales)
    );

    expect(section(sections, 'hero').heading).toBe(
      mercur.homepage.sections.hero.heading[mercur.locales.default]
    );
    expect(section(sections, 'hero').locale_fallback).toBeNull();
  });
});

describe('AC2 — a missing variant falls back to market.locales.default and is labelled', () => {
  const { homepage, locales } = readMarket('bonbeauty');
  const nonDefault = locales.supported.find(locale => locale !== locales.default)!;

  it('uses the market default copy and reports the fallback per field', () => {
    const mutated = structuredClone(homepage);
    delete mutated.sections.banner.label[nonDefault];

    const sections = normalizeHomepageSections(mutated, 'bonbeauty', nonDefault as any, context(locales));

    const banner = section(sections, 'banner');
    expect(banner.label).toBe(homepage.sections.banner.label[locales.default]);
    expect(banner.locale_fallback).toEqual({
      locale: locales.default,
      fields: ['sections.banner.label'],
      // Heading and subheading still resolved in the route locale, so the section
      // must NOT be stamped with the fallback language.
      whole: false,
    });
  });

  it('scopes the fallback to the section that fell back (party review PR-2)', () => {
    const mutated = structuredClone(homepage);
    delete mutated.sections.banner.label[nonDefault];

    const sections = normalizeHomepageSections(mutated, 'bonbeauty', nonDefault as any, context(locales));

    expect(section(sections, 'hero').locale_fallback).toBeNull();
    expect(section(sections, 'hero').heading).toBe(homepage.sections.hero.heading[nonDefault]);
    expect(section(sections, 'blog_section').locale_fallback).toBeNull();
  });

  it('flags a repeatable child label that fell back', () => {
    const mutated = structuredClone(homepage);
    delete mutated.sections.style_section.items[1].label[nonDefault];

    const sections = normalizeHomepageSections(mutated, 'bonbeauty', nonDefault as any, context(locales));

    expect(section(sections, 'style_section').locale_fallback).toEqual({
      locale: locales.default,
      fields: ['sections.style_section.items[1].label'],
      whole: false,
    });
  });

  it('marks the section as WHOLE only when every translatable field fell back', () => {
    const mutated = structuredClone(homepage);
    // blog_section has exactly one translatable field.
    delete mutated.sections.blog_section.heading[nonDefault];

    const sections = normalizeHomepageSections(mutated, 'bonbeauty', nonDefault as any, context(locales));

    expect(section(sections, 'blog_section').locale_fallback).toEqual({
      locale: locales.default,
      fields: ['sections.blog_section.heading'],
      whole: true,
    });
  });

  it('does not flag a fallback when the route locale IS the market default', () => {
    const mutated = structuredClone(homepage);
    delete mutated.sections.banner.label[nonDefault];

    const sections = normalizeHomepageSections(
      mutated,
      'bonbeauty',
      locales.default as any,
      context(locales)
    );

    expect(section(sections, 'banner').locale_fallback).toBeNull();
  });
});

describe('AC4 — legacy scalar shim and fail-loud shape guard', () => {
  const { homepage, locales } = readMarket('bonbeauty');
  const nonDefault = locales.supported.find(locale => locale !== locales.default)!;

  it('reads a legacy scalar as the market default and marks it as a fallback', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));

    try {
      const mutated = structuredClone(homepage);
      mutated.sections.blog_section.heading = 'Blog urodowy';

      const sections = normalizeHomepageSections(mutated, 'bonbeauty', nonDefault as any, context(locales));
      const blog = section(sections, 'blog_section');

      expect(blog.heading).toBe('Blog urodowy');
      expect(blog.locale_fallback.locale).toBe(locales.default);
      expect(warnings.some(entry => entry.includes('sections.blog_section.heading'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('throws instead of letting a malformed locale map reach the renderer', () => {
    const mutated = structuredClone(homepage);
    mutated.sections.hero.heading = { [locales.default]: { nested: 'object' } };

    expect(() =>
      normalizeHomepageSections(mutated, 'bonbeauty', locales.default as any, context(locales))
    ).toThrow(/locale entries must be strings/);
  });

  it('never emits a raw locale map for any active locale of any migrated market', () => {
    for (const marketId of ['bonbeauty', 'mercur', 'bongarden', 'bonevent']) {
      const market = readMarket(marketId);

      for (const locale of market.locales.supported) {
        const sections =
          normalizeHomepageSections(
            structuredClone(market.homepage),
            marketId,
            locale as any,
            context(market.locales)
          ) ?? [];

        for (const entry of sections as any[]) {
          for (const [key, value] of Object.entries(entry)) {
            if (key === 'locale_fallback' || key === 'image') continue;
            expect(
              typeof value === 'object' && value !== null && !Array.isArray(value),
              `${marketId}/${locale}: ${entry.blockType}.${key} is still a map`
            ).toBe(false);
          }
        }
      }
    }
  });
});
