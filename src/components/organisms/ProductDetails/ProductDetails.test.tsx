/**
 * ProductDetails organism unit tests — v1.7.0 Story 2.3
 *
 * Tests:
 * - VoucherClaritySurface integration: receives product data, variant derived correctly
 * - SellerProofSurface integration: receives seller data
 * - Multi-vendor pricing dispatch preserved (flag ON/OFF branches)
 * - variant change consistency (T4): hasPrice derives correct VoucherClarityVariant
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';

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
vi.mock('@/lib/helpers/get-product-price', () => ({
  getProductPrice: vi.fn().mockReturnValue({ cheapestVariant: null, cheapestPrice: null, variantPrice: null }),
}));

vi.mock('@/components/cells', () => ({
  ProductAdditionalAttributes: 'ProductAdditionalAttributes',
  ProductDetailsFooter: 'ProductDetailsFooter',
  ProductDetailsHeader: 'ProductDetailsHeader',
  ProductDetailsSeller: 'ProductDetailsSeller',
  ProductDetailsShipping: 'ProductDetailsShipping',
  ProductPageDetails: 'ProductPageDetails',
  VoucherClaritySurface: vi.fn().mockResolvedValue(
    React.createElement('div', { 'data-testid': 'voucher-clarity-surface' }, 'VoucherClaritySurface')
  ),
  SellerProofSurface: vi.fn().mockResolvedValue(
    React.createElement('div', { 'data-testid': 'seller-proof-surface' }, 'SellerProofSurface')
  ),
}));

vi.mock('@/components/molecules/VendorBadge', () => ({
  VendorBadge: 'VendorBadge',
}));

vi.mock('@/components/cells/SellerSelector', () => ({
  NoActiveVendorsFallback: 'NoActiveVendorsFallback',
  SellerSelectorCartBridge: 'SellerSelectorCartBridge',
  SoleVendorBadge: 'SoleVendorBadge',
}));

vi.mock('@/components/organisms/TrustSignals/TrustSignals', () => ({
  TrustSignals: 'TrustSignals',
}));

vi.mock('@/components/molecules', () => ({
  VoucherValidityInfo: 'VoucherValidityInfo',
}));

vi.mock('@/lib/security/flagAtomicCheck', () => ({
  getCurrentFlagValue: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/voucher/voucher-copy', () => ({
  deriveVoucherClarityVariant: vi.fn().mockReturnValue('default'),
  resolveValidityWording: vi.fn().mockReturnValue(null),
}));

import { resolveDefaultValidityInfo, resolvePdpTrustSignals } from '@/lib/runtime-market-config';
import { getCurrentFlagValue } from '@/lib/security/flagAtomicCheck';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { deriveVoucherClarityVariant, resolveValidityWording } from '@/lib/voucher/voucher-copy';
import { VoucherClaritySurface, SellerProofSurface } from '@/components/cells';
import { ProductDetails } from './ProductDetails';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function findAll(
  el: React.ReactNode,
  predicate: (el: ReactEl) => boolean,
  results: ReactEl[] = [],
): ReactEl[] {
  if (React.isValidElement<Record<string, unknown>>(el)) {
    const element = el as ReactEl;
    if (predicate(element)) results.push(element);
    const children = React.Children.toArray(element.props.children as React.ReactNode);
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
    variants: [],
    ...overrides,
  };
}

describe('ProductDetails — VoucherClaritySurface integration (Story 2.3)', () => {
  it('renders VoucherClaritySurface in place of TrustSignals+VoucherValidityInfo', async () => {
    vi.mocked(resolvePdpTrustSignals).mockResolvedValue([]);
    vi.mocked(resolveDefaultValidityInfo).mockResolvedValue(null);
    const product = makeProduct();

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    // VoucherClaritySurface should be present
    const found = findAll(result as ReactEl, el => el.type === VoucherClaritySurface);
    expect(found).toHaveLength(1);
  });

  it('passes validity wording from resolveValidityWording to VoucherClaritySurface', async () => {
    vi.mocked(resolveDefaultValidityInfo).mockResolvedValue('Ważny 12 miesięcy');
    vi.mocked(resolveValidityWording).mockReturnValue('12 miesięcy od daty zakupu');
    const product = makeProduct({ metadata: { gp: { validity_period: '12 miesięcy od daty zakupu' } } });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as ReactEl, el => el.type === VoucherClaritySurface);
    expect(found).toHaveLength(1);
    expect(found[0].props.validityWording).toBe('12 miesięcy od daty zakupu');
  });

  it('derives variant via deriveVoucherClarityVariant (single source of truth for Story 2.4)', async () => {
    vi.mocked(getProductPrice).mockReturnValue({ cheapestVariant: null, cheapestPrice: null, variantPrice: null } as never);
    vi.mocked(deriveVoucherClarityVariant).mockReturnValue('error');
    const product = makeProduct();

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as ReactEl, el => el.type === VoucherClaritySurface);
    expect(found[0].props.variant).toBe('error');
  });

  it('passes trust signals as realizationRules to VoucherClaritySurface', async () => {
    vi.mocked(resolvePdpTrustSignals).mockResolvedValue(['Realizacja w salonie', '14-dniowy zwrot']);
    vi.mocked(deriveVoucherClarityVariant).mockReturnValue('default');
    const product = makeProduct();

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as ReactEl, el => el.type === VoucherClaritySurface);
    expect(found[0].props.realizationRules).toEqual([
      { text: 'Realizacja w salonie' },
      { text: '14-dniowy zwrot' },
    ]);
  });
});

describe('ProductDetails — SellerProofSurface integration (Story 2.3)', () => {
  it('renders SellerProofSurface when product has a seller', async () => {
    const product = makeProduct({
      seller: {
        id: 'sel-1',
        name: 'Beauty & Co',
        handle: 'beauty-co',
        photo: null,
        status: 'open',
        reviews: [],
        products: [],
      },
    });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as ReactEl, el => el.type === SellerProofSurface);
    expect(found).toHaveLength(1);
  });

  it('does NOT render SellerProofSurface when product has no seller', async () => {
    const product = makeProduct({ seller: undefined });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as ReactEl, el => el.type === SellerProofSurface);
    expect(found).toHaveLength(0);
  });

  it('passes seller name and handle to SellerProofSurface', async () => {
    const product = makeProduct({
      seller: {
        id: 'sel-1',
        name: 'Salon Wellness',
        handle: 'salon-wellness',
        photo: null,
        status: 'open',
        reviews: [],
      },
    });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as ReactEl, el => el.type === SellerProofSurface);
    expect(found[0].props.seller).toMatchObject({
      name: 'Salon Wellness',
      handle: 'salon-wellness',
      status: 'open',
    });
  });

  it('computes rating from seller reviews and passes to SellerProofSurface', async () => {
    const product = makeProduct({
      seller: {
        id: 'sel-1',
        name: 'Rated Salon',
        handle: 'rated-salon',
        photo: null,
        status: 'open',
        reviews: [
          { rating: 5, id: 'r1' },
          { rating: 3, id: 'r2' },
        ],
      },
    });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(result as ReactEl, el => el.type === SellerProofSurface);
    const sellerProps = found[0].props.seller as { rating: number; reviewCount: number };
    // Average of 5 + 3 = 4
    expect(sellerProps.rating).toBe(4);
    expect(sellerProps.reviewCount).toBe(2);
  });
});

describe('ProductDetails — multi-vendor pricing dispatch preserved (Story 5.x)', () => {
  it('with flag OFF: does not render SellerSelectorCartBridge', async () => {
    vi.mocked(getCurrentFlagValue).mockReturnValue(false);
    const product = makeProduct({
      vendor_offers: [
        { seller_id: 's1', seller_name: 'Salon A', price_pln: 100 },
        { seller_id: 's2', seller_name: 'Salon B', price_pln: 120 },
      ],
    });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(
      result as ReactEl,
      el => el.type === 'SellerSelectorCartBridge',
    );
    expect(found).toHaveLength(0);
  });

  it('with flag ON and >=2 offers: renders SellerSelectorCartBridge', async () => {
    vi.mocked(getCurrentFlagValue).mockReturnValue(true);
    const product = makeProduct({
      vendor_offers: [
        { seller_id: 's1', seller_name: 'Salon A', price_pln: 100 },
        { seller_id: 's2', seller_name: 'Salon B', price_pln: 120 },
      ],
    });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(
      result as ReactEl,
      el => el.type === 'SellerSelectorCartBridge',
    );
    expect(found).toHaveLength(1);
  });

  it('with flag ON and 0 offers: renders NoActiveVendorsFallback', async () => {
    vi.mocked(getCurrentFlagValue).mockReturnValue(true);
    const product = makeProduct({ vendor_offers: [] });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(
      result as ReactEl,
      el => el.type === 'NoActiveVendorsFallback',
    );
    expect(found).toHaveLength(1);
  });

  it('with flag ON and 1 offer: renders SoleVendorBadge', async () => {
    vi.mocked(getCurrentFlagValue).mockReturnValue(true);
    const product = makeProduct({
      vendor_offers: [{ seller_id: 's1', seller_name: 'Salon A', price_pln: 100 }],
    });

    const result = await ProductDetails({ product: product as never, locale: 'pl' });

    const found = findAll(
      result as ReactEl,
      el => el.type === 'SoleVendorBadge',
    );
    expect(found).toHaveLength(1);
  });
});
