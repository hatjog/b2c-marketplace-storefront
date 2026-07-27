/**
 * Story 1.4 v1.14.0 AC4 — PDP dziedziczy gate ze wspólnego fetchera.
 *
 * Kontrakt AD-4: gate zostaje we WSPÓLNYM fetcherze
 * (`fetchProductForDetailPage` → `listProducts` → `normalizeListedProducts`),
 * a `notFound()` na direct-PDP zapada WYŁĄCZNIE dla `product == null` albo
 * seller-inactive — NIGDY z powodu długości opisu czy `bar` w FAZIE 1.
 *
 * Test jest strukturalny TAM, gdzie strukturalny być musi (zakaz drugiego
 * miejsca oceny jakości — to twierdzenie o NIEISTNIENIU kodu), i behawioralny
 * tam, gdzie może (published produkt ze stubem UA przechodzi przez wspólny
 * normalizator, więc fetcher zwraca encję, a nie null).
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn()
}));

vi.mock('@/lib/helpers/market-filter', () => ({
  getMarketId: () => 'bonbeauty'
}));

import {
  normalizeListedProducts,
  type ListedProduct
} from '@/lib/helpers/normalize-listed-products';

const STOREFRONT_SRC = path.resolve(__dirname, '../../..');

const readSource = (relative: string) =>
  fs.readFileSync(path.resolve(STOREFRONT_SRC, relative), 'utf8');

// 12 słów — realny stub UA z evidence 1.3.
const UA_STUB = 'Ароматерапія масаж з оліями для глибокого розслаблення тіла та відновлення сил щодня';

function publishedProductWithUaStub(overrides: Partial<ListedProduct> = {}): ListedProduct {
  return {
    id: 'prod_1',
    handle: 'aromaterapia-masaz',
    title: 'Ароматерапія',
    status: 'published',
    description: UA_STUB,
    thumbnail: 'https://cdn.gp.local/aroma.jpg',
    images: [],
    variants: [{ id: 'var_1', calculated_price: { calculated_amount: 18000 } }],
    seller: { id: 'sel_1', status: 'open' },
    metadata: { gp: { content_bar: { pl: { words: 187, bar: true }, ua: { words: 12, bar: false } } } },
    ...overrides
  } as unknown as ListedProduct;
}

describe('AC4 — jedno miejsce oceny jakości', () => {
  it('PDP fetcher nie ma własnej oceny jakości ani wordcountu', () => {
    const fetcher = readSource('lib/data/product-detail-fetcher.ts');

    expect(fetcher).not.toMatch(/MIN_DESCRIPTION_WORDS|content_bar|split\(\/\\s\+\//);
    expect(fetcher).toContain('listProducts');
  });

  it('route PDP nie 404-uje na kryteriach jakościowych', () => {
    const route = readSource('app/[locale]/(main)/products/[handle]/page.tsx');

    expect(route).not.toContain('notFound');
    expect(route).not.toContain('MIN_DESCRIPTION_WORDS');
    expect(route).not.toContain('content_bar');
  });

  it('notFound() na PDP zapada wyłącznie dla null / seller-inactive', () => {
    const section = readSource('components/sections/ProductDetailsPage/ProductDetailsPage.tsx');

    const notFoundGuards = section
      .split('\n')
      .filter(line => line.includes('notFound()') && !line.trimStart().startsWith('//'))
      .map(line => line.trim());

    expect(notFoundGuards).toEqual(['if (!prod) notFound();', 'if (!isSellerActive(prod.seller)) notFound();']);
  });

  it('kryterium `description` żyje w JEDNYM pliku (brak drugiego gate\'u)', () => {
    const gateOwners = ['lib/helpers/normalize-listed-products.ts'];
    const scanned = [
      'lib/data/product-detail-fetcher.ts',
      'lib/data/products.ts',
      'components/sections/ProductDetailsPage/ProductDetailsPage.tsx'
    ];

    for (const owner of gateOwners) {
      expect(readSource(owner)).toContain('MIN_DESCRIPTION_WORDS');
    }
    for (const file of scanned) {
      expect(readSource(file)).not.toContain('MIN_DESCRIPTION_WORDS');
    }
  });
});

describe('AC4 — published produkt ze stubem UA przechodzi wspólny tor (⇒ PDP 200)', () => {
  it('FAZA 1: normalizator zwraca produkt, więc fetcher nie da null', () => {
    const [product] = normalizeListedProducts([publishedProductWithUaStub()], undefined, {
      gateSlug: 'pl'
    });

    // `fetchProductForDetailPage` zwraca `response.products[0] ?? null` —
    // niepusty wynik normalizatora to dokładnie warunek „nie notFound()".
    expect(product).toBeDefined();
    expect(product.handle).toBe('aromaterapia-masaz');
  });

  it('seller-inactive nadal wypada z toru (notFound na PDP zostaje uzasadniony)', () => {
    const product = publishedProductWithUaStub({
      seller: { id: 'sel_2', status: 'suspended' }
    } as Partial<ListedProduct>);

    expect(normalizeListedProducts([product], undefined, { gateSlug: 'pl' })).toEqual([]);
  });
});
