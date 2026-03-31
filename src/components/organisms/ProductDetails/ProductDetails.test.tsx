import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies before importing the component under test
vi.mock('@medusajs/types', () => ({ HttpTypes: {} }));
vi.mock('@/lib/data/customer', () => ({ retrieveCustomer: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/data/wishlist', () => ({ getUserWishlists: vi.fn().mockResolvedValue({ products: [] }) }));
vi.mock('@/lib/helpers/country-code', () => ({ getCountryCode: vi.fn().mockResolvedValue('pl') }));
vi.mock('@/lib/helpers/market-filter', () => ({ getMarketId: vi.fn().mockReturnValue('pl') }));
vi.mock('@/lib/runtime-market-config', () => ({
  resolvePdpTrustSignals: vi.fn().mockResolvedValue([]),
  resolveDefaultValidityInfo: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/components/cells', () => ({
  ProductAdditionalAttributes: 'ProductAdditionalAttributes',
  ProductDetailsFooter: 'ProductDetailsFooter',
  ProductDetailsHeader: 'ProductDetailsHeader',
  ProductDetailsSeller: 'ProductDetailsSeller',
  ProductDetailsShipping: 'ProductDetailsShipping',
  ProductPageDetails: 'ProductPageDetails',
}));
vi.mock('@/components/organisms/TrustSignals/TrustSignals', () => ({
  TrustSignals: 'TrustSignals',
}));
vi.mock('@/components/molecules', () => ({
  VoucherValidityInfo: 'VoucherValidityInfo',
}));

import { resolveDefaultValidityInfo } from '@/lib/runtime-market-config';
import { ProductDetails } from './ProductDetails';

function findAll(
  el: React.ReactNode,
  predicate: (el: React.ReactElement) => boolean,
  results: React.ReactElement[] = [],
): React.ReactElement[] {
  if (React.isValidElement(el)) {
    if (predicate(el)) results.push(el);
    const children = React.Children.toArray(el.props.children);
    for (const child of children) {
      findAll(child, predicate, results);
    }
  }
  return results;
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    title: 'Test Voucher',
    description: 'Test description',
    tags: [],
    created_at: '2024-01-01',
    attribute_values: [],
    seller: undefined,
    metadata: {},
    ...overrides,
  };
}

describe('ProductDetails — VoucherValidityInfo integration', () => {
  it('passes validityPeriod from product metadata to VoucherValidityInfo', async () => {
    vi.mocked(resolveDefaultValidityInfo).mockResolvedValue(null);
    const product = makeProduct({ metadata: { gp: { validity_period: '12 miesięcy od daty zakupu' } } });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as React.ReactElement, el => el.type === 'VoucherValidityInfo');
    expect(found).toHaveLength(1);
    expect(found[0].props.validityPeriod).toBe('12 miesięcy od daty zakupu');
    expect(found[0].props.defaultInfo).toBeNull();
  });

  it('passes null validityPeriod and defaultInfo from config when product has no validity_period', async () => {
    vi.mocked(resolveDefaultValidityInfo).mockResolvedValue('Ważny 12 miesięcy');
    const product = makeProduct({ metadata: {} });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as React.ReactElement, el => el.type === 'VoucherValidityInfo');
    expect(found).toHaveLength(1);
    expect(found[0].props.validityPeriod).toBeNull();
    expect(found[0].props.defaultInfo).toBe('Ważny 12 miesięcy');
  });

  it('passes null for both props when neither validity_period nor defaultInfo exists', async () => {
    vi.mocked(resolveDefaultValidityInfo).mockResolvedValue(null);
    const product = makeProduct({ metadata: {} });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as React.ReactElement, el => el.type === 'VoucherValidityInfo');
    expect(found).toHaveLength(1);
    expect(found[0].props.validityPeriod).toBeNull();
    expect(found[0].props.defaultInfo).toBeNull();
  });

  it('validityPeriod from product wins over defaultInfo from config', async () => {
    vi.mocked(resolveDefaultValidityInfo).mockResolvedValue('Ważny 12 miesięcy');
    const product = makeProduct({ metadata: { gp: { validity_period: '6 miesięcy' } } });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as React.ReactElement, el => el.type === 'VoucherValidityInfo');
    expect(found).toHaveLength(1);
    expect(found[0].props.validityPeriod).toBe('6 miesięcy');
    expect(found[0].props.defaultInfo).toBe('Ważny 12 miesięcy');
  });

  it('VoucherValidityInfo appears after TrustSignals in the DOM order', async () => {
    vi.mocked(resolveDefaultValidityInfo).mockResolvedValue(null);
    const product = makeProduct({ metadata: { gp: { validity_period: '12 miesięcy' } } });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const children = React.Children.toArray((result as React.ReactElement).props.children);
    const trustIdx = children.findIndex(
      (c) => React.isValidElement(c) && c.type === 'TrustSignals',
    );
    const validityIdx = children.findIndex(
      (c) => React.isValidElement(c) && c.type === 'VoucherValidityInfo',
    );
    expect(trustIdx).toBeGreaterThanOrEqual(0);
    expect(validityIdx).toBeGreaterThan(trustIdx);
  });
});
