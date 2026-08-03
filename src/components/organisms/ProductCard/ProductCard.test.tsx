import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({ default: 'mock-image' }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/components/molecules/LocalizedLink/LocalizedLink', () => ({
  default: 'mock-link',
}))
vi.mock('@/components/atoms', () => ({
  Button: 'mock-button',
}))
vi.mock('@/lib/helpers/get-product-price', () => ({
  getProductPrice: () => ({
    cheapestPrice: {
      calculated_price: '100 zł',
      original_price: '100 zł',
    },
    cheapestVariant: null,
  }),
}))
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { ProductCard } from './ProductCard'

type ReactEl = React.ReactElement<Record<string, unknown>>

// ---------------------------------------------------------------------------
// Tree traversal helpers
// ---------------------------------------------------------------------------

function findElement(
  element: React.ReactNode,
  predicate: (el: ReactEl) => boolean,
): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(element)) return null
  const el = element as ReactEl
  if (predicate(el)) return el
  const children = React.Children.toArray(el.props.children as React.ReactNode)
  for (const child of children) {
    if (!React.isValidElement(child)) continue
    const found = findElement(child, predicate)
    if (found) return found
  }
  return null
}

function findText(node: React.ReactNode, text: string): boolean {
  if (typeof node === 'string') return node.includes(text)
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<Record<string, unknown>>
    const children = React.Children.toArray(el.props.children as React.ReactNode)
    return children.some(c => findText(c, text))
  }
  return false
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const baseProduct = {
  id: 'prod_01',
  handle: 'masaz-relaksacyjny',
  title: 'Masaż relaksacyjny',
  thumbnail: null,
  variants: [],
  tags: [],
} as any

const sellerData = {
  name: 'Salon Piękności',
  handle: 'salon-pieknosci',
  id: 'sel_01',
}

// ---------------------------------------------------------------------------
// ProductCard — vendor name display (AC #1, #4)
// ---------------------------------------------------------------------------

describe('ProductCard — vendor name (AC #1)', () => {
  it('exposes data-testid="product-card" on the wrapper element (E2E contract — Story v160-cleanup-11)', () => {
    const result = ProductCard({ product: baseProduct }) as ReactEl
    expect(result).not.toBeNull()
    // Wrapper is the top-level element returned by ProductCard.
    const props = (result.props ?? {}) as Record<string, unknown>
    expect(props['data-testid']).toBe('product-card')
  })

  it('renders vendor name when seller is present', () => {
    const product = { ...baseProduct, seller: sellerData }
    const result = ProductCard({ product }) as ReactEl
    expect(result).not.toBeNull()
    const hasVendorName = findText(result, sellerData.name)
    expect(hasVendorName).toBe(true)
  })

  it('renders vendor badge container with data-testid when seller is present', () => {
    const product = { ...baseProduct, seller: sellerData }
    const result = ProductCard({ product }) as ReactEl
    const vendorDiv = findElement(
      result,
      el =>
        React.isValidElement(el) &&
        (el as React.ReactElement<Record<string, unknown>>).props?.['data-testid'] === 'product-card-vendor',
    )
    expect(vendorDiv).not.toBeNull()
  })

  it('renders a single whole-card link to the product page', () => {
    const result = ProductCard({ product: baseProduct }) as ReactEl
    expect(result.type).toBe('mock-link')
    expect((result.props as Record<string, unknown>).href).toBe(`/products/${baseProduct.handle}`)
    expect(String((result.props as Record<string, unknown>).className)).toContain('pcard')
  })

  it('does not render a nested vendor link inside the whole-card target', () => {
    const product = { ...baseProduct, seller: sellerData }
    const result = ProductCard({ product }) as ReactEl
    const vendorLink = findElement(
      result,
      el =>
        el.type === 'mock-link' &&
        typeof (el as React.ReactElement<Record<string, unknown>>).props?.href === 'string' &&
        ((el as React.ReactElement<Record<string, unknown>>).props.href as string).includes('/sellers/'),
    )
    expect(vendorLink).toBeNull()
  })

  it('does NOT render vendor section when seller is absent (AC #4)', () => {
    const result = ProductCard({ product: baseProduct }) as ReactEl
    expect(result).not.toBeNull()
    const vendorDiv = findElement(
      result,
      el =>
        React.isValidElement(el) &&
        (el as React.ReactElement<Record<string, unknown>>).props?.['data-testid'] === 'product-card-vendor',
    )
    expect(vendorDiv).toBeNull()
  })

  it('does NOT render vendor name text when seller is absent (AC #4)', () => {
    const result = ProductCard({ product: baseProduct }) as ReactEl
    const hasVendorName = findText(result, sellerData.name)
    expect(hasVendorName).toBe(false)
  })

  it('renders without errors when seller is null (AC #4)', () => {
    const product = { ...baseProduct, seller: null }
    expect(() => ProductCard({ product })).not.toThrow()
  })

  it('renders without errors when seller is undefined (AC #4)', () => {
    expect(() => ProductCard({ product: baseProduct })).not.toThrow()
  })
})

describe('ProductCard — core rendering', () => {
  it('renders product title', () => {
    const result = ProductCard({ product: baseProduct }) as ReactEl
    const hasTitleText = findText(result, baseProduct.title)
    expect(hasTitleText).toBe(true)
  })

  it('returns null when product is falsy', () => {
    const result = ProductCard({ product: null as any })
    expect(result).toBeNull()
  })

  it('does not render price section when showPrice=false', () => {
    const result = ProductCard({ product: baseProduct, showPrice: false }) as ReactEl
    const priceContainer = findElement(
      result,
      el => (el.props as Record<string, unknown>)?.['data-testid'] === 'product-card-price',
    )
    expect(priceContainer).toBeNull()
  })

  it('does not render vendor name when showVendor=false even if seller exists', () => {
    const product = { ...baseProduct, seller: sellerData }
    const result = ProductCard({ product, showVendor: false }) as ReactEl
    expect(findText(result, sellerData.name)).toBe(false)
  })

  it('does not render the legacy see-more CTA', () => {
    const result = ProductCard({ product: baseProduct }) as ReactEl
    const legacyCta = findElement(
      result,
      el => (el.props as Record<string, unknown>)?.['data-testid'] === 'product-card-see-more-button',
    )
    expect(legacyCta).toBeNull()
  })
})
