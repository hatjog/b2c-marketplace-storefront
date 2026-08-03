/**
 * Story 1.4 v1.14.0 AC4 — rozstrzygnięcie SEO ADR-153 pkt 3 (amend ADR-164).
 *
 * PDP poniżej progu jakości w danym locale dostaje `noindex` ORAZ wypada
 * z hreflang-setu — sygnały SEO są spójne, bo „self-noindex bez
 * hreflang/sitemap-exclude" to alternatywa jawnie odrzucona w ADR-153.
 * Sygnałem jest `metadata.gp.content_bar[<locale>].bar` (AD-4) — ten sam,
 * którego używa `checkQualityGate`; storefront nadal nie liczy słów.
 *
 * Trzeci sygnał — sitemap-exclude — jest spełniony konstrukcyjnie i pilnowany
 * przez `src/lib/seo/sitemap-pdp-exclusion.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpTypes } from '@medusajs/types';

vi.mock('next/headers', () => ({
  headers: async () =>
    new Map<string, string>([
      ['host', 'bonbeauty.example'],
      ['x-forwarded-proto', 'https']
    ])
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `t:${key}`
}));

vi.mock('@/lib/market-locales', () => ({
  resolveMarketLocales: async () => ({
    supported: ['pl', 'en', 'ua', 'de'],
    defaultLocale: 'pl'
  })
}));

const { generateProductMetadata } = await import('../seo');

type Alternates = { canonical: string; languages: Record<string, string> };

function makeProduct(contentBar?: unknown): HttpTypes.StoreProduct {
  return {
    id: 'prod_1',
    title: 'Aromaterapia',
    handle: 'aromaterapia-masaz',
    thumbnail: 'https://cdn.example/aroma.jpg',
    metadata: {
      gp: {
        vendor_name: 'Salon',
        ...(contentBar === undefined ? {} : { content_bar: contentBar })
      }
    }
  } as unknown as HttpTypes.StoreProduct;
}

// Stan po backfillu w FAZIE 1: PL zielony, tłumaczenia to stuby < 80 słów.
const PHASE_1_BAR = {
  pl: { words: 187, bar: true },
  ua: { words: 12, bar: false },
  de: { words: 13, bar: false },
  en: { words: 14, bar: false }
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_NAME = 'BonBeauty';
  delete process.env.NEXT_PUBLIC_BASE_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('AC4 — noindex + hreflang-exclude na sygnale content_bar', () => {
  it('/pl (bar = true): index, follow', async () => {
    const metadata = await generateProductMetadata(makeProduct(PHASE_1_BAR), 'pl');

    expect(metadata.robots).toBe('index, follow');
  });

  it('/de (bar = false): noindex, follow — treść to fallback PL, nie niemiecka', async () => {
    const metadata = await generateProductMetadata(makeProduct(PHASE_1_BAR), 'de');

    expect(metadata.robots).toBe('noindex, follow');
  });

  it('hreflang-set zawiera TYLKO locale powyżej progu (+ x-default na pl)', async () => {
    const metadata = await generateProductMetadata(makeProduct(PHASE_1_BAR), 'de');
    const alternates = metadata.alternates as Alternates;

    expect(Object.keys(alternates.languages).sort()).toEqual(['pl-PL', 'x-default']);
    expect(alternates.languages['uk-UA']).toBeUndefined();
    expect(alternates.languages['de-DE']).toBeUndefined();
  });

  it('canonical zostaje self-em bieżącego locale nawet przy noindex', async () => {
    const metadata = await generateProductMetadata(makeProduct(PHASE_1_BAR), 'de');
    const alternates = metadata.alternates as Alternates;

    expect(alternates.canonical).toContain('/de/products/aromaterapia-masaz');
  });

  it('locale wchodzi do hreflang-setu, gdy jego bar zrobi się zielony (Epic 4)', async () => {
    const shipped = { ...PHASE_1_BAR, ua: { words: 95, bar: true } };
    const metadata = await generateProductMetadata(makeProduct(shipped), 'ua');
    const alternates = metadata.alternates as Alternates;

    expect(metadata.robots).toBe('index, follow');
    expect(Object.keys(alternates.languages).sort()).toEqual(['pl-PL', 'uk-UA', 'x-default']);
  });

  it('x-default znika, gdy nawet default marketu jest poniżej progu', async () => {
    const allRed = {
      pl: { words: 3, bar: false },
      en: { words: 2, bar: false },
      ua: { words: 2, bar: false },
      de: { words: 2, bar: false }
    };
    const metadata = await generateProductMetadata(makeProduct(allRed), 'pl');
    const alternates = metadata.alternates as Alternates;

    expect(alternates.languages).toEqual({});
    expect(metadata.robots).toBe('noindex, follow');
  });
});

describe('AC5/EE-1 — encja bez content_bar zachowuje zastane SEO', () => {
  it.each([
    ['brak content_bar', undefined],
    ['content_bar = null', null],
    ['content_bar uszkodzony', { pl: { words: 90, bar: 'true' } }],
    ['brak wpisu dla locale', { en: { words: 90, bar: true } }]
  ])('%s ⇒ index, follow + pełny hreflang-set', async (_label, contentBar) => {
    const metadata = await generateProductMetadata(makeProduct(contentBar), 'de');
    const alternates = metadata.alternates as Alternates;

    expect(metadata.robots).toBe('index, follow');
    expect(Object.keys(alternates.languages).sort()).toEqual([
      'de-DE',
      'en-US',
      'pl-PL',
      'uk-UA',
      'x-default'
    ]);
  });
});
