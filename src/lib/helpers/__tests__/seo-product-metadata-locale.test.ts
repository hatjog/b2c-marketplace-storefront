/**
 * v1.14.0 Story 1.3 — AC3: metadata PDP bez cichego fallbacku do pl-PL.
 *
 * Test regresyjny na DOKŁADNIE tę klasę błędu, która wycofała reland w
 * v1.13.0: hardcoded polski literał fallback description w
 * `generateProductMetadata` wyciekał do SERP / og:description /
 * twitter:description dla /ua /de /en, a kanoniki potrafiły wskazywać pl.
 *
 * `getTranslations` jest zamockowane na PRAWDZIWE pliki messages/<locale>.json
 * (nie na sztuczne stringi) — asercje działają na tych samych tłumaczeniach,
 * które widzi produkcja, więc podmiana klucza `pdp.meta.description_fallback`
 * na literał (albo usunięcie klucza z messages) robi test czerwonym.
 * Wymóg jawnego `{ locale }` w wywołaniu jest częścią kontraktu (R-7): mock
 * rzuca, gdy seo.ts poprosi o kontekstozależną formę.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpTypes } from '@medusajs/types';

// --- Mock next/headers: deterministyczny host (crawler bez env) -------------

vi.mock('next/headers', () => ({
  headers: async () =>
    new Map<string, string>([
      ['host', 'bonbeauty.example'],
      ['x-forwarded-proto', 'https']
    ])
}));

// --- Mock next-intl/server: PRAWDZIWE messages, wymuszony jawny locale ------

type Messages = Record<string, unknown>;
const messagesCache = new Map<string, Messages>();

function loadMessages(locale: string): Messages {
  const cached = messagesCache.get(locale);
  if (cached) return cached;
  const file = path.resolve(__dirname, `../../../../messages/${locale}.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Messages;
  messagesCache.set(locale, parsed);
  return parsed;
}

function resolveKey(messages: Messages, dottedKey: string): string {
  const value = dottedKey
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  if (typeof value !== 'string') {
    throw new Error(`Brak klucza i18n: ${dottedKey}`);
  }
  return value;
}

vi.mock('next-intl/server', () => ({
  getTranslations: async (arg: unknown) => {
    // Kontrakt R-7: metadata NIGDY nie rozwiązuje locale z kontekstu requestu.
    if (!arg || typeof arg !== 'object' || !('locale' in (arg as object))) {
      throw new Error(
        'generateProductMetadata użył kontekstozależnego getTranslations — AC3 wymaga jawnego { locale } z route`u'
      );
    }
    const { locale, namespace } = arg as { locale: string; namespace?: string };
    const messages = loadMessages(locale);
    return (key: string, params?: Record<string, string>) => {
      const template = resolveKey(messages, namespace ? `${namespace}.${key}` : key);
      return template.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? `{${name}}`);
    };
  }
}));

// --- Mock market-locales: pełny market 4-locale (deployment bonbeauty) ------

vi.mock('@/lib/market-locales', () => ({
  resolveMarketLocales: async () => ({
    supported: ['pl', 'en', 'ua', 'de'],
    defaultLocale: 'pl'
  })
}));

const { generateProductMetadata } = await import('../seo');

// --- Fixtures ---------------------------------------------------------------

function makeProduct(overrides?: Partial<HttpTypes.StoreProduct>): HttpTypes.StoreProduct {
  return {
    id: 'prod_1',
    title: 'Розслаблюючий масаж',
    handle: 'masaz-relaksacyjny',
    thumbnail: 'https://cdn.example/masaz.jpg',
    metadata: { gp: { vendor_name: 'Salon Kyiv' } },
    ...overrides
  } as HttpTypes.StoreProduct;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_NAME = 'BonBeauty';
  delete process.env.NEXT_PUBLIC_BASE_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Story 1.3 AC3 — generateProductMetadata bez PL fallbacku', () => {
  it('/ua: description z messages/ua.json, ZERO polskiego literału w SERP/og/twitter', async () => {
    const metadata = await generateProductMetadata(makeProduct(), 'ua');

    const expected = 'Розслаблюючий масаж — ваучер на послугу в Salon Kyiv. Купуйте на BonBeauty.';
    expect(metadata.description).toBe(expected);
    expect(metadata.openGraph?.description).toBe(expected);
    expect((metadata.twitter as { description?: string })?.description).toBe(expected);

    // Regresja v1.13.0: dawny hardcoded PL literał NIE MA prawa wrócić.
    for (const channel of [
      metadata.description,
      metadata.openGraph?.description,
      (metadata.twitter as { description?: string })?.description
    ]) {
      expect(channel).not.toContain('voucher na zabieg');
      expect(channel).not.toContain('Kup na');
    }
  });

  it('/ua: canonical locale-specific wskazuje /ua, nie pl; hreflang zgodny z kontraktem (ua↔uk-UA)', async () => {
    const metadata = await generateProductMetadata(makeProduct(), 'ua');
    const alternates = metadata.alternates as {
      canonical: string;
      languages: Record<string, string>;
    };

    expect(alternates.canonical).toContain('/ua/products/masaz-relaksacyjny');
    expect(alternates.canonical).not.toContain('/pl/');
    expect(alternates.canonical).not.toContain('pl-PL');

    // Zastany kontrakt hreflang (R9): mapa ua↔uk-UA bez zmian, x-default → pl.
    expect(alternates.languages['uk-UA']).toContain('/ua/products/masaz-relaksacyjny');
    expect(alternates.languages['pl-PL']).toContain('/pl/products/masaz-relaksacyjny');
    expect(alternates.languages['x-default']).toContain('/pl/products/masaz-relaksacyjny');

    // OG locale w formie language_TERRITORY.
    expect(metadata.openGraph?.locale).toBe('uk_UA');
  });

  it('parzystość: /pl i /de dostają fallback we WŁASNYM języku (ten sam klucz, 4 locale)', async () => {
    const pl = await generateProductMetadata(makeProduct({ title: 'Masaż relaksacyjny' }), 'pl');
    expect(pl.description).toBe(
      'Masaż relaksacyjny — voucher na zabieg w Salon Kyiv. Kup na BonBeauty.'
    );

    const de = await generateProductMetadata(makeProduct({ title: 'Entspannungsmassage' }), 'de');
    expect(de.description).toContain('Gutschein für eine Behandlung bei Salon Kyiv');
  });

  it('jawne metadata.gp.seo.meta_description wygrywa z fallbackiem (bez regresji ADR-054)', async () => {
    const metadata = await generateProductMetadata(
      makeProduct({
        metadata: {
          gp: { seo: { meta_description: 'Опис від продавця' }, vendor_name: 'Salon Kyiv' }
        }
      }),
      'ua'
    );

    expect(metadata.description).toBe('Опис від продавця');
  });
});
