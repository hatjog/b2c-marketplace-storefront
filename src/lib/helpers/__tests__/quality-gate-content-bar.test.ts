/**
 * Story 1.4 v1.14.0 — AC2 / AC3 / AC5.
 *
 * Dowód behawioralny (nie strukturalny): gate ocenia produkt po
 * `metadata.gp.content_bar[<slug>].bar` i NIE liczy słów pobranego opisu.
 * Bez tego FAZA 1 jest niemożliwa — fetch dla `/de` dostaje przetłumaczony
 * (stubowy) overlay, więc liczenie w storefroncie zwróciłoby pusty katalog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn()
}));

vi.mock('@/lib/helpers/market-filter', () => ({
  getMarketId: () => 'bonbeauty'
}));

import * as Sentry from '@sentry/nextjs';

import {
  MIN_DESCRIPTION_WORDS,
  normalizeListedProducts,
  resetLegacyGateSignalThrottleForTests,
  type ListedProduct
} from '../normalize-listed-products';

// 12 słów — realny kształt stuba UA z evidence 1.3 (10–15 słów, < 80).
const UA_STUB_DESCRIPTION = 'Ароматерапія масаж з оліями для глибокого розслаблення тіла та відновлення сил щодня';
const LONG_PL_DESCRIPTION = Array.from({ length: 120 }, (_, i) => `słowo${i}`).join(' ');

function buildProduct(overrides: Partial<ListedProduct> = {}): ListedProduct {
  return {
    id: 'prod_1',
    handle: 'aromaterapia-masaz',
    title: 'Aromaterapia',
    status: 'published',
    description: UA_STUB_DESCRIPTION,
    thumbnail: 'https://cdn.gp.local/aromaterapia.jpg',
    images: [],
    variants: [{ id: 'var_1', calculated_price: { calculated_amount: 18000 } }],
    seller: { id: 'sel_1', status: 'open' },
    ...overrides
  } as unknown as ListedProduct;
}

function withContentBar(bar: unknown, overrides: Partial<ListedProduct> = {}): ListedProduct {
  return buildProduct({
    metadata: { gp: { content_bar: bar } },
    ...overrides
  } as Partial<ListedProduct>);
}

const handles = (products: ListedProduct[]) => products.map(p => p.handle);

beforeEach(() => {
  resetLegacyGateSignalThrottleForTests();
  vi.mocked(Sentry.captureMessage).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AC2 — gate czyta wyłącznie content_bar, nie zlicza słów', () => {
  it('produkt z content_bar.pl.bar = true przechodzi mimo 12-słowego opisu UA', () => {
    const product = withContentBar({ pl: { words: 187, bar: true }, ua: { words: 12, bar: false } });

    expect(handles(normalizeListedProducts([product]))).toEqual(['aromaterapia-masaz']);
  });

  it('ten sam produkt odpadłby na zastanym wordcount — dowód, że semantyka faktycznie się zmieniła', () => {
    const words = UA_STUB_DESCRIPTION.split(/\s+/).filter(Boolean).length;
    expect(words).toBeLessThan(MIN_DESCRIPTION_WORDS);
  });

  it('content_bar.pl.bar = false ⇒ produkt odpada (gate nadal działa)', () => {
    const product = withContentBar({ pl: { words: 12, bar: false } });

    expect(normalizeListedProducts([product])).toEqual([]);
  });

  it('długi opis nie ratuje produktu z bar = false — decyduje sygnał, nie tekst', () => {
    const product = withContentBar({ pl: { words: 3, bar: false } }, {
      description: LONG_PL_DESCRIPTION
    });

    expect(normalizeListedProducts([product])).toEqual([]);
  });

  it('Sentry „quality gate drift" nadal raportuje published + failed, z przyczyną content_bar', () => {
    const product = withContentBar({ pl: { words: 12, bar: false } });
    normalizeListedProducts([product]);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("content_bar['pl'].bar = false"),
      expect.objectContaining({ level: 'warning' })
    );
  });

  it('kryteria price / image / isSellerActive bez zmian (regresja)', () => {
    const bar = { pl: { words: 187, bar: true } };

    const noPrice = withContentBar(bar, { id: 'p_noprice', handle: 'no-price', variants: [] });
    const noImage = withContentBar(bar, { id: 'p_noimg', handle: 'no-image-product', thumbnail: null });
    const placeholder = withContentBar(bar, {
      id: 'p_ph',
      handle: 'placeholder-thumb',
      thumbnail: 'https://via.placeholder.com/300'
    });
    const inactiveSeller = withContentBar(bar, {
      id: 'p_inactive',
      handle: 'inactive-seller',
      seller: { id: 'sel_2', status: 'suspended' }
    } as Partial<ListedProduct>);

    expect(normalizeListedProducts([noPrice, noImage, placeholder, inactiveSeller])).toEqual([]);
  });
});

describe('AC3 — wybór sluga: FAZA 1 (pl) vs FAZA 2 (locale)', () => {
  const stagedProduct = () =>
    withContentBar({ pl: { words: 187, bar: true }, ua: { words: 12, bar: false } });

  it('FAZA 1 (default, brak gateSlug) przepuszcza produkt na /ua', () => {
    expect(handles(normalizeListedProducts([stagedProduct()]))).toEqual(['aromaterapia-masaz']);
  });

  it('FAZA 1 jawna (gateSlug = pl) — ten sam wynik', () => {
    expect(handles(normalizeListedProducts([stagedProduct()], undefined, { gateSlug: 'pl' }))).toEqual([
      'aromaterapia-masaz'
    ]);
  });

  it('FAZA 2 dla ua (gateSlug = ua) odfiltrowuje ten sam produkt', () => {
    expect(normalizeListedProducts([stagedProduct()], undefined, { gateSlug: 'ua' })).toEqual([]);
  });

  it('FAZA 2 dla locale z zielonym barem przepuszcza', () => {
    const product = withContentBar({ pl: { words: 187, bar: true }, ua: { words: 95, bar: true } });

    expect(handles(normalizeListedProducts([product], undefined, { gateSlug: 'ua' }))).toEqual([
      'aromaterapia-masaz'
    ]);
  });
});

describe('AC5 — EE-1: brak/uszkodzony content_bar ⇒ legacy wordcount', () => {
  it.each([
    ['brak metadata.gp', undefined],
    ['content_bar = null', null],
    ['content_bar = string', 'yes'],
    ['content_bar = tablica', [{ bar: true }]],
    ['brak wpisu dla sluga', { de: { words: 90, bar: true } }],
    ['bar nie-boolean', { pl: { words: 90, bar: 'true' } }],
    ['wpis nie-obiekt', { pl: true }]
  ])('%s ⇒ krótki opis odpada po staremu (próg 80)', (_label, bar) => {
    const product =
      bar === undefined ? buildProduct() : withContentBar(bar);

    expect(normalizeListedProducts([product])).toEqual([]);
  });

  it.each([
    ['brak metadata.gp', undefined],
    ['content_bar = null', null],
    ['bar nie-boolean', { pl: { words: 90, bar: 'true' } }]
  ])('%s ⇒ długi opis (>= 80 słów) NADAL przechodzi — okno migracji nie zeruje katalogu', (_label, bar) => {
    const product =
      bar === undefined
        ? buildProduct({ description: LONG_PL_DESCRIPTION })
        : withContentBar(bar, { description: LONG_PL_DESCRIPTION });

    expect(handles(normalizeListedProducts([product]))).toEqual(['aromaterapia-masaz']);
  });

  it('uszkodzony kształt nigdy nie rzuca — listing przeżywa', () => {
    const product = withContentBar({ pl: { words: 'dużo', bar: null } });

    expect(() => normalizeListedProducts([product])).not.toThrow();
  });

  it('wejście na ścieżkę legacy jest obserwowalne, agregowane per batch', () => {
    const batch = [
      buildProduct({ id: 'a', handle: 'a', description: LONG_PL_DESCRIPTION }),
      buildProduct({ id: 'b', handle: 'b', description: LONG_PL_DESCRIPTION })
    ];

    normalizeListedProducts(batch);

    const legacySignals = vi
      .mocked(Sentry.captureMessage)
      .mock.calls.filter(([message]) => String(message).includes('legacy fallback (EE-1)'));

    // Jeden sygnał na batch z licznikiem — NIE jeden na produkt.
    expect(legacySignals).toHaveLength(1);
    expect(legacySignals[0][0]).toContain('2/2 products');
  });

  it('sygnał legacy jest dławiony w czasie (brak per-request spamu)', () => {
    const batch = [buildProduct({ description: LONG_PL_DESCRIPTION })];

    normalizeListedProducts(batch);
    normalizeListedProducts(batch);
    normalizeListedProducts(batch);

    const legacySignals = vi
      .mocked(Sentry.captureMessage)
      .mock.calls.filter(([message]) => String(message).includes('legacy fallback (EE-1)'));

    expect(legacySignals).toHaveLength(1);
  });

  it('brak encji na ścieżce legacy ⇒ zero sygnału (nie zaśmiecamy po backfillu)', () => {
    const product = withContentBar({ pl: { words: 187, bar: true } });

    normalizeListedProducts([product]);

    const legacySignals = vi
      .mocked(Sentry.captureMessage)
      .mock.calls.filter(([message]) => String(message).includes('legacy fallback (EE-1)'));

    expect(legacySignals).toHaveLength(0);
  });
});
