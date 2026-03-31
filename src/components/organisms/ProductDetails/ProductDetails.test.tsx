import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock('@/lib/data/customer', () => ({
  retrieveCustomer: async () => null,
}))
vi.mock('@/lib/data/wishlist', () => ({
  getUserWishlists: async () => ({ products: [] }),
}))
vi.mock('@/lib/helpers/country-code', () => ({
  getCountryCode: async () => 'pl',
}))
vi.mock('@/lib/helpers/market-filter', () => ({
  getMarketId: () => 'pl-market',
}))
vi.mock('@/lib/runtime-market-config', () => ({
  resolvePdpTrustSignals: async () => [],
}))
vi.mock('@/components/cells', () => ({
  ProductAdditionalAttributes: 'mock-additional-attributes',
  ProductDetailsFooter: 'mock-details-footer',
  ProductDetailsHeader: 'mock-details-header',
  ProductDetailsSeller: 'mock-details-seller',
  ProductDetailsShipping: 'mock-details-shipping',
  ProductPageDetails: 'mock-page-details',
}))
vi.mock('@/components/organisms/TrustSignals/TrustSignals', () => ({
  TrustSignals: 'mock-trust-signals',
}))
vi.mock('@/components/molecules/VendorBadge', () => ({
  VendorBadge: 'mock-vendor-badge',
}))

import { ProductDetails } from './ProductDetails'

// ---------------------------------------------------------------------------
// Tree traversal helpers
// ---------------------------------------------------------------------------

function findElement(
  element: React.ReactElement,
  predicate: (el: React.ReactElement) => boolean,
): React.ReactElement | null {
  if (!React.isValidElement(element)) return null
  const el = element as React.ReactElement<Record<string, unknown>>
  if (predicate(el)) return el
  const children = React.Children.toArray(el.props?.children ?? [])
  for (const child of children) {
    if (!React.isValidElement(child)) continue
    const found = findElement(child as React.ReactElement, predicate)
    if (found) return found
  }
  return null
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const baseSeller = {
  id: 'sel_01',
  name: 'Salon Piękności',
  handle: 'salon-pieknosci',
  photo: 'https://example.com/photo.jpg',
  description: 'Opis salonu',
  tax_id: '',
  created_at: '2024-01-01',
  products: [{ id: 'p1' }, { id: 'p2' }],
  store_status: 'ACTIVE' as const,
}

const baseProduct = {
  id: 'prod_01',
  handle: 'masaz-relaksacyjny',
  title: 'Masaż relaksacyjny',
  thumbnail: null,
  variants: [],
  tags: [],
  images: [],
  description: '',
  attribute_values: [],
  created_at: '2024-01-01',
} as any

// ---------------------------------------------------------------------------
// ProductDetails — VendorBadge (AC #2, #3, #4)
// ---------------------------------------------------------------------------

describe('ProductDetails — VendorBadge integration (AC #2, #3, #4)', () => {
  it('renders VendorBadge when seller is present (AC #2)', async () => {
    const product = { ...baseProduct, seller: baseSeller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    expect(badge).not.toBeNull()
  })

  it('VendorBadge receives variant="pdp" (AC #2)', async () => {
    const product = { ...baseProduct, seller: baseSeller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    expect((badge!.props as Record<string, unknown>).variant).toBe('pdp')
  })

  it('VendorBadge vendor.name matches seller.name (AC #2)', async () => {
    const product = { ...baseProduct, seller: baseSeller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    const vendor = (badge!.props as Record<string, unknown>).vendor as Record<string, unknown>
    expect(vendor.name).toBe(baseSeller.name)
  })

  it('VendorBadge vendor.handle matches seller.handle (AC #3)', async () => {
    const product = { ...baseProduct, seller: baseSeller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    const vendor = (badge!.props as Record<string, unknown>).vendor as Record<string, unknown>
    expect(vendor.handle).toBe(baseSeller.handle)
  })

  it('VendorBadge vendor.photoUrl comes from seller.photo (AC #2)', async () => {
    const product = { ...baseProduct, seller: baseSeller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    const vendor = (badge!.props as Record<string, unknown>).vendor as Record<string, unknown>
    expect(vendor.photoUrl).toBe(baseSeller.photo)
  })

  it('VendorBadge vendor.productCount uses seller.products length (AC #2)', async () => {
    const product = { ...baseProduct, seller: baseSeller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    const vendor = (badge!.props as Record<string, unknown>).vendor as Record<string, unknown>
    expect(vendor.productCount).toBe(baseSeller.products.length)
  })

  it('does NOT render VendorBadge when seller is absent (AC #4)', async () => {
    const result = (await ProductDetails({ product: baseProduct, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    expect(badge).toBeNull()
  })

  it('does NOT render VendorBadge when seller is null (AC #4)', async () => {
    const product = { ...baseProduct, seller: null }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    expect(badge).toBeNull()
  })

  it('renders without error when seller is absent (AC #4)', async () => {
    await expect(ProductDetails({ product: baseProduct, locale: 'pl' })).resolves.not.toThrow()
  })

  it('vendor.photoUrl is null when seller.photo is empty string', async () => {
    const product = { ...baseProduct, seller: { ...baseSeller, photo: '' } }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    const vendor = (badge!.props as Record<string, unknown>).vendor as Record<string, unknown>
    expect(vendor.photoUrl).toBeNull()
  })

  it('vendor.productCount is 0 when seller has no products array', async () => {
    const seller = { ...baseSeller, products: undefined }
    const product = { ...baseProduct, seller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const badge = findElement(result, el => el.type === 'mock-vendor-badge')
    const vendor = (badge!.props as Record<string, unknown>).vendor as Record<string, unknown>
    expect(vendor.productCount).toBe(0)
  })

  it('renders vendor badge container with data-testid (AC #2)', async () => {
    const product = { ...baseProduct, seller: baseSeller }
    const result = (await ProductDetails({ product, locale: 'pl' })) as React.ReactElement
    const container = findElement(
      result,
      el =>
        React.isValidElement(el) &&
        (el as React.ReactElement<Record<string, unknown>>).props?.['data-testid'] ===
          'product-details-vendor-badge',
    )
    expect(container).not.toBeNull()
  })
})
