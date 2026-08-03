/**
 * QD-03 acceptance proof (SPEC-storefront-i18n-completeness, CAP-3).
 *
 * Co ten test dowodzi: `ProductDetailsPage` buduje chrome PDP z locale, które
 * DOSTAŁ, a nie z tego, które akurat leży w request store. Dlatego:
 *
 *  - lista locale pochodzi z `market.locales.supported` REALNEGO
 *    `GP/config/gp-dev/markets/bonbeauty/market.yaml` (żadnej drugiej listy
 *    w teście — wymóg „Always" tego pakietu),
 *  - stub `getTranslations` czyta REALNE `messages/<locale>.json` i celowo
 *    IGNORUJE jakikolwiek kontekst: jedynym źródłem locale jest argument.
 *    Stub zwracający tę samą wartość dla każdego locale byłby testem-widmem,
 *    więc test najpierw dowodzi, że słowniki faktycznie się różnią,
 *  - stub rzuca, gdy wywołanie przyjdzie w formie kontekstozależnej —
 *    czyli regresja do `getTranslations('pdp')` wywraca ten plik, nie tylko lint.
 */

import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const MESSAGES_ROOT = path.resolve(__dirname, '../../../../messages');
const MARKET_YAML = path.resolve(
  __dirname,
  '../../../../../config/gp-dev/markets/bonbeauty/market.yaml'
);

type MessageNode = string | { [key: string]: MessageNode };

function readMessages(locale: string): Record<string, MessageNode> {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES_ROOT, `${locale}.json`), 'utf8'));
}

function lookup(dict: Record<string, MessageNode>, dottedPath: string): string {
  const value = dottedPath.split('.').reduce<MessageNode | undefined>((node, segment) => {
    if (node && typeof node === 'object') return node[segment];
    return undefined;
  }, dict);
  if (typeof value !== 'string') {
    throw new Error(`[test] brak klucza ${dottedPath}`);
  }
  return value;
}

const market = yaml.load(fs.readFileSync(MARKET_YAML, 'utf8')) as {
  locales: { default: string; supported: string[] };
};
const SUPPORTED_LOCALES = market.locales.supported;

vi.mock('@/lib/helpers/country-code', () => ({
  getCountryCode: vi.fn().mockResolvedValue('pl')
}));
vi.mock('@/lib/data/product-detail-fetcher', () => ({
  fetchProductForDetailPage: vi.fn().mockImplementation(async () => ({
    id: 'prod_1',
    title: 'Oczyszczanie twarzy',
    description: null,
    variants: [],
    categories: [],
    metadata: {},
    seller: {
      id: 'sel_1',
      name: 'Salon',
      handle: 'salon',
      verified: true,
      status: 'open',
      reviews: []
    }
  }))
}));
vi.mock('@/lib/data/reviews', () => ({
  getProductReviews: vi
    .fn()
    .mockResolvedValue({ reviews: [], count: 0, offset: 0, limit: 0, average_rating: 0, rating_count: 0 }),
  getSellerReviews: vi
    .fn()
    .mockResolvedValue({ reviews: [], count: 0, offset: 0, limit: 0, average_rating: 0, rating_count: 0 })
}));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@/components/organisms', () => ({ ProductGallery: 'ProductGallery' }));
vi.mock('@/components/organisms/ProductDetails/ProductDetails', () => ({
  ProductDetails: 'ProductDetails'
}));
vi.mock('../CrossSellSection', () => ({ CrossSellSection: 'CrossSellSection' }));
vi.mock('./ProductDetailsTabs', () => ({ ProductDetailsTabs: 'ProductDetailsTabs' }));
vi.mock('@/components/cells/StickyAddToCart/StickyAddToCart', () => ({
  StickyAddToCart: 'StickyAddToCart'
}));

/**
 * Stub bez kontekstu: locale MUSI przyjść argumentem. Forma skrócona
 * (`getTranslations('pdp')`) rzuca — to jest ten sam warunek, którego pilnuje
 * `gp/explicit-locale-get-translations`, tylko egzekwowany w runtime.
 */
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(async (arg: unknown) => {
    if (typeof arg !== 'object' || arg === null) {
      throw new Error(
        '[test] getTranslations bez jawnego locale — w tym teście nie ma request store, ' +
          'dokładnie jak w kontynuacji async poza drzewem page/layout.'
      );
    }
    const { locale, namespace } = arg as { locale: string; namespace: string };
    const dict = readMessages(locale);
    const translate = (key: string) => lookup(dict, `${namespace}.${key}`);
    return Object.assign(translate, { locale, namespace });
  })
}));

import { ProductDetailsPage } from './ProductDetailsPage';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function collect(node: React.ReactNode, out: ReactEl[] = []): ReactEl[] {
  if (Array.isArray(node)) {
    node.forEach(child => collect(child, out));
    return out;
  }
  if (React.isValidElement<Record<string, unknown>>(node)) {
    out.push(node);
    collect(node.props.children as React.ReactNode, out);
  }
  return out;
}

function trustBarLabels(tree: React.ReactNode): string[] {
  const bars = collect(tree).filter(
    el => typeof el.props['data-testid'] === 'string' && String(el.props['data-testid']).includes('trust-bar')
  );
  const items = bars.flatMap(bar => (bar.props.items as { label: string }[]) ?? []);
  return items.map(item => item.label);
}

describe('QD-03 AC1 — PDP chrome renderuje locale trasy', () => {
  it('rynek jest faktycznie wielojęzyczny (inaczej test niczego nie mierzy)', () => {
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(1);
  });

  it('słowniki różnią się między locale (stub nie może zwracać jednej wartości)', () => {
    const values = SUPPORTED_LOCALES.map(locale =>
      lookup(readMessages(locale), 'pdp.trust_bar.return_30_days')
    );
    expect(new Set(values).size).toBe(SUPPORTED_LOCALES.length);
  });

  it.each(SUPPORTED_LOCALES)('trust bar PDP w locale %s', async locale => {
    const tree = await ProductDetailsPage({ handle: 'oczyszczanie-twarzy', locale });
    const labels = trustBarLabels(tree);
    const dict = readMessages(locale);

    expect(labels.length).toBeGreaterThan(0);
    for (const key of [
      'marketplace_verified',
      'return_30_days',
      'polish_support',
      'instant_pdf'
    ]) {
      expect(labels).toContain(lookup(dict, `pdp.trust_bar.${key}`));
    }
  });

  it.each(SUPPORTED_LOCALES.filter(locale => locale !== market.locales.default))(
    'locale %s nie pokazuje chrome domyślnego locale',
    async locale => {
      const tree = await ProductDetailsPage({ handle: 'oczyszczanie-twarzy', locale });
      const labels = trustBarLabels(tree);
      const defaultDict = readMessages(market.locales.default);

      for (const key of ['return_30_days', 'polish_support']) {
        expect(labels).not.toContain(lookup(defaultDict, `pdp.trust_bar.${key}`));
      }
    }
  );

  it('seller proof i verified mark też idą z locale trasy', async () => {
    const locale = SUPPORTED_LOCALES.find(candidate => candidate !== market.locales.default)!;
    const tree = await ProductDetailsPage({ handle: 'oczyszczanie-twarzy', locale });
    const dict = readMessages(locale);

    const verified = collect(tree).find(el => el.props['data-testid'] === 'pdp-verified-mark');
    expect(verified?.props.label).toBe(lookup(dict, 'pdp.verified_seller'));

    const proof = collect(tree).find(el => el.props['data-testid'] === 'pdp-seller-proof');
    const labels = proof?.props.labels as Record<string, unknown>;
    expect(labels.yearsLabel).toBe(lookup(dict, 'pdp.seller_proof.years_label'));
    expect(labels.viewSeller).toBe(lookup(dict, 'pdp.seller_proof.view_seller'));
  });
});
