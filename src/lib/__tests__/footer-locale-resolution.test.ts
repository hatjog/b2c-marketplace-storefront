/**
 * QD-02 acceptance proof (SPEC-storefront-i18n-completeness).
 *
 * Runs against the REAL assembled runtime config in `GP/config/gp-dev` and the
 * REAL `messages/*.json`, not hand-written fixtures. A migration that only
 * satisfies a fixture is the "mechanism exists but is dead on the real path"
 * failure this package removes — and QD-01 already paid for that lesson once.
 *
 * The locale set under test is read from each market's own `market.yaml`, so
 * this file keeps no competing list of locales (ADR-154).
 */

import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';
import { describe, expect, it, vi } from 'vitest';

import { resolveFooterCopyright, resolveFooterNavLinks } from '../footer';
import {
  resolveFooterLocalizedCopy,
  resolveRuntimePortalMarketConfig
} from '../runtime-market-config';

const CONFIG_ROOT = path.resolve(__dirname, '../../../../config/gp-dev/markets');
const MESSAGES_ROOT = path.resolve(__dirname, '../../../messages');

// The nav resolver consumes the NORMALIZED footer, where `url` has already been
// renamed to `href`. Feeding it raw YAML would test a shape that never reaches
// production — the first draft of this file did exactly that and passed nothing.
process.env.GP_CONFIG_ROOT = path.resolve(__dirname, '../../../../config');
process.env.GP_INSTANCE_ID = 'gp-dev';

async function loadNormalizedFooter(marketId: string, locale: string, locales: Locales) {
  const config = await resolveRuntimePortalMarketConfig(
    marketId,
    locale as any,
    context(locales)
  );
  return config?.footer ?? null;
}

type Locales = { default: string; supported: string[] };

function readMarket(marketId: string) {
  const market = yaml.load(
    fs.readFileSync(path.join(CONFIG_ROOT, marketId, 'market.yaml'), 'utf8')
  ) as any;

  return {
    footer: market.storefront?.footer ?? null,
    locales: market.locales as Locales
  };
}

function context(locales: Locales) {
  return { supported: locales.supported as any, defaultLocale: locales.default as any };
}

/** A chrome translator backed by the real message catalogue for one locale. */
function chromeTranslator(locale: string) {
  const messages = JSON.parse(
    fs.readFileSync(path.join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
  );

  return (key: string) => {
    const value = key
      .split('.')
      .reduce<any>((node, segment) => (node == null ? node : node[segment]), messages.footer);
    return typeof value === 'string' ? value : null;
  };
}

const MARKETS = fs
  .readdirSync(CONFIG_ROOT, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .filter(marketId => readMarket(marketId).footer !== null);

describe('AC — every configured market has a migrated footer', () => {
  it('exercises more than one market and at least one multilingual one', () => {
    expect(MARKETS.length).toBeGreaterThan(1);
    expect(MARKETS.some(m => readMarket(m).locales.supported.length > 1)).toBe(true);
  });

  it.each(MARKETS)('%s ships a copyright locale map covering locales.supported', marketId => {
    const { footer, locales } = readMarket(marketId);

    expect(typeof footer.copyright).toBe('object');
    expect(Object.keys(footer.copyright).sort()).toEqual([...locales.supported].sort());
  });

  it.each(MARKETS)('%s carries routes only — no editable nav label', marketId => {
    const { footer } = readMarket(marketId);

    for (const link of footer.nav_links ?? []) {
      expect(Object.keys(link)).toEqual(['url']);
    }
  });
});

describe('AC1 — copyright resolves per route locale, never another language', () => {
  const marketId = 'bonbeauty';
  const { footer, locales } = readMarket(marketId);

  it.each(locales.supported)('resolves BonBeauty copyright for %s', locale => {
    const resolved = resolveFooterLocalizedCopy(structuredClone(footer), {
      locale: locale as any,
      marketLocales: context(locales),
      marketId
    });

    const copyright = resolveFooterCopyright({ market_id: marketId, footer: resolved });

    expect(typeof copyright).toBe('string');
    expect(copyright).toBe(footer.copyright[locale]);
    expect(resolved?.copyright_fallback).toBeNull();
  });

  it('produces a DIFFERENT string for every locale — no silent PL bleed', () => {
    const values = locales.supported.map(locale =>
      resolveFooterLocalizedCopy(structuredClone(footer), {
        locale: locale as any,
        marketLocales: context(locales),
        marketId
      })?.copyright
    );

    expect(new Set(values).size).toBe(locales.supported.length);
  });

  it('reports a whole-fragment fallback when the route variant is missing', () => {
    const stripped = structuredClone(footer);
    delete stripped.copyright.ua;

    const resolved = resolveFooterLocalizedCopy(stripped, {
      locale: 'ua' as any,
      marketLocales: context(locales),
      marketId
    });

    expect(resolved?.copyright).toBe(footer.copyright[locales.default]);
    expect(resolved?.copyright_fallback).toEqual({
      locale: locales.default,
      whole: true,
      fromLegacyScalar: false
    });
  });

  it('labels a Payload-shaped legacy scalar as a fallback instead of a translation', () => {
    // The Payload API fallback path has no `localized: true` on footer_copyright,
    // so a scalar is a permanent, real input here — not just a migration artifact.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const resolved = resolveFooterLocalizedCopy(
      { copyright: '© 2026 BonBeauty. Wszelkie prawa zastrzezone.' } as any,
      { locale: 'de' as any, marketLocales: context(locales), marketId }
    );

    expect(resolved?.copyright_fallback).toEqual({
      locale: locales.default,
      whole: true,
      fromLegacyScalar: true
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('AC2 — nav labels come from the route locale, not from config', () => {
  const { locales } = readMarket('bonbeauty');

  it.each(locales.supported)('BonBeauty footer nav renders in %s', async locale => {
    const { footer: raw, locales: marketLocales } = readMarket('bonbeauty');
    const footer = await loadNormalizedFooter('bonbeauty', locale, marketLocales);
    const sections = resolveFooterNavLinks(
      { market_id: 'bonbeauty', footer },
      null,
      chromeTranslator(locale)
    );

    const labels = sections.flatMap(section => section.links.map(link => link.label));

    // Every configured route resolved — nothing silently dropped.
    expect(labels).toHaveLength(raw.nav_links.length);

    const expected = chromeTranslator(locale);
    expect(labels).toEqual([
      expected('nav.about'),
      expected('nav.faq'),
      expected('nav.kontakt'),
      expected('nav.regulamin'),
      expected('nav.polityka-prywatnosci')
    ]);
  });

  it('renders no Polish label on UA, DE or EN (CAP-2)', async () => {
    const polish = ['O nas', 'Kontakt', 'Regulamin', 'Polityka prywatności'];

    for (const locale of ['en', 'ua', 'de']) {
      const footer = await loadNormalizedFooter('bonbeauty', locale, locales);
      const labels = resolveFooterNavLinks(
        { market_id: 'bonbeauty', footer },
        null,
        chromeTranslator(locale)
      ).flatMap(section => section.links.map(link => link.label));

      // "Kontakt" is genuinely the German word too — exclude only where the
      // translation legitimately coincides, never by blanket-allowing the locale.
      const forbidden = locale === 'de' ? polish.filter(l => l !== 'Kontakt') : polish;
      for (const label of labels) {
        expect(forbidden).not.toContain(label);
      }
    }
  });

  it.each(MARKETS)('%s configures only routes the canonical contract knows', async marketId => {
    const { footer: raw, locales: marketLocales } = readMarket(marketId);
    const footer = await loadNormalizedFooter(marketId, marketLocales.default, marketLocales);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const sections = resolveFooterNavLinks(
      { market_id: marketId, footer },
      null,
      chromeTranslator(marketLocales.default)
    );
    const rendered = sections.flatMap(section => section.links);

    expect(rendered).toHaveLength((raw.nav_links ?? []).length);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
