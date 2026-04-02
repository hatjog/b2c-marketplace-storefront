import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// String mocks: React treats them as intrinsic elements; props are preserved on the element.
vi.mock('next/image', () => ({ default: 'mock-next-image' }))
vi.mock('next/link', () => ({ default: 'mock-link' }))
vi.mock('@/icons', () => ({ ArrowRightIcon: 'mock-arrow-icon' }))

import { getColorFromHandle, getInitialsFromName, produktPlural } from '@/lib/helpers/vendor-badge'
import { VendorBadge } from '.'

type ReactEl = React.ReactElement<Record<string, unknown>>

// ---------------------------------------------------------------------------
// Tree traversal helper
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const baseVendor = {
  name: 'Salon Piękności',
  handle: 'salon-pieknosci',
  photoUrl: 'https://example.com/photo.jpg',
  productCount: 5,
}

// ---------------------------------------------------------------------------
// Pure utility tests
// ---------------------------------------------------------------------------

describe('getInitialsFromName', () => {
  it('extracts initials from two-word name', () => {
    expect(getInitialsFromName('Salon Piękności')).toBe('SP')
  })

  it('returns single initial for one-word name', () => {
    expect(getInitialsFromName('BonBeauty')).toBe('B')
  })

  it('caps at 2 initials for three-word name', () => {
    expect(getInitialsFromName('Salon De Beaute')).toBe('SD')
  })

  it('handles empty string without throwing', () => {
    expect(getInitialsFromName('')).toBe('')
  })

  it('uppercases initials', () => {
    expect(getInitialsFromName('anna kowalska')).toBe('AK')
  })
})

describe('produktPlural', () => {
  it('returns "1 produkt" for 1', () => {
    expect(produktPlural(1)).toBe('1 produkt')
  })

  it('returns "2 produkty" for 2-4', () => {
    expect(produktPlural(2)).toBe('2 produkty')
    expect(produktPlural(3)).toBe('3 produkty')
    expect(produktPlural(4)).toBe('4 produkty')
  })

  it('returns "5 produktów" for 5-21', () => {
    expect(produktPlural(5)).toBe('5 produktów')
    expect(produktPlural(12)).toBe('12 produktów')
    expect(produktPlural(21)).toBe('21 produktów')
  })

  it('returns "22 produkty" for 22-24', () => {
    expect(produktPlural(22)).toBe('22 produkty')
    expect(produktPlural(23)).toBe('23 produkty')
  })

  it('returns "0 produktów" for 0', () => {
    expect(produktPlural(0)).toBe('0 produktów')
  })

  it('returns "113 produktów" for teens pattern', () => {
    expect(produktPlural(113)).toBe('113 produktów')
  })
})

describe('getColorFromHandle', () => {
  it('returns a non-empty string', () => {
    expect(typeof getColorFromHandle('test-handle')).toBe('string')
    expect(getColorFromHandle('test-handle').length).toBeGreaterThan(0)
  })

  it('is deterministic for the same handle', () => {
    expect(getColorFromHandle('abc')).toBe(getColorFromHandle('abc'))
  })

  it('returns a valid hex color string', () => {
    expect(getColorFromHandle('abc')).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(getColorFromHandle('test-handle')).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(getColorFromHandle('')).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

// ---------------------------------------------------------------------------
// VendorBadge component tests
// ---------------------------------------------------------------------------

describe('VendorBadge — link (AC #2, #5)', () => {
  it('renders link to /salony/[handle]', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    // Root element is the mocked Link ('mock-link')
    expect(result.type).toBe('mock-link')
    expect(result.props.href).toBe('/salony/salon-pieknosci')
  })

  it('has aria-label describing salon name', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    expect(result.props['aria-label']).toBe('Profil salonu Salon Piękności')
  })
})

describe('VendorBadge — avatar with image (AC #4)', () => {
  it('renders next/image when photoUrl is provided', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img).not.toBeNull()
    expect(img!.props.src).toBe(baseVendor.photoUrl)
    expect(img!.props.alt).toBe(baseVendor.name)
  })

  it('pdp variant uses 48px for image dimensions', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img!.props.width).toBe(48)
    expect(img!.props.height).toBe(48)
  })

  it('header variant uses 72px for image dimensions (AC #1)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'header' }) as ReactEl
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img!.props.width).toBe(72)
    expect(img!.props.height).toBe(72)
  })

  it('image has onError handler for fallback (AC #3, #4)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(typeof img!.props.onError).toBe('function')
  })
})

describe('VendorBadge — initials fallback (AC #3)', () => {
  it('does NOT render image when photoUrl is null', () => {
    const result = VendorBadge({
      vendor: { ...baseVendor, photoUrl: null },
      variant: 'pdp',
    }) as ReactEl
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img).toBeNull()
  })

  it('renders initials span always (CSS fallback behind image)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const initialsSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'SP',
    )
    expect(initialsSpan).not.toBeNull()
  })

  it('renders correct initials when photoUrl is null', () => {
    const result = VendorBadge({
      vendor: { ...baseVendor, photoUrl: null },
      variant: 'pdp',
    }) as ReactEl
    const initialsSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'SP',
    )
    expect(initialsSpan).not.toBeNull()
  })

  it('onError handler hides image (CSS fallback revealed)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const img = findElement(result, el => el.type === 'mock-next-image')
    // onError sets display: 'none' on the image — initials behind are always present
    expect(typeof img!.props.onError).toBe('function')
    // Initials are always rendered regardless of image state
    const initialsSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'SP',
    )
    expect(initialsSpan).not.toBeNull()
  })
})

describe('VendorBadge — pdp variant content (AC #1)', () => {
  it('shows vendor name', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const nameSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'Salon Piękności',
    )
    expect(nameSpan).not.toBeNull()
  })

  it('shows product count text', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const countSpan = findElement(
      result,
      el =>
        el.type === 'span' &&
        typeof el.props.children === 'string' &&
        el.props.children.includes('5'),
    )
    expect(countSpan).not.toBeNull()
  })

  it('renders arrow icon', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as ReactEl
    const arrow = findElement(result, el => el.type === 'mock-arrow-icon')
    expect(arrow).not.toBeNull()
    expect(arrow!.props.size).toBe(20)
  })
})

describe('VendorBadge — header variant (AC #1)', () => {
  it('does NOT render arrow icon', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'header' }) as ReactEl
    const arrow = findElement(result, el => el.type === 'mock-arrow-icon')
    expect(arrow).toBeNull()
  })

  it('does NOT render vendor name label in header variant', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'header' }) as ReactEl
    const nameSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'Salon Piękności',
    )
    expect(nameSpan).toBeNull()
  })
})
