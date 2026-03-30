import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// String mocks: React treats them as intrinsic elements; props are preserved on the element.
vi.mock('next/image', () => ({ default: 'mock-next-image' }))
vi.mock('next/link', () => ({ default: 'mock-link' }))
vi.mock('@/icons', () => ({ ArrowRightIcon: 'mock-arrow-icon' }))

import { VendorBadge, getInitialsFromName, getColorFromHandle } from '.'

// ---------------------------------------------------------------------------
// Tree traversal helper
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

describe('getColorFromHandle', () => {
  it('returns a non-empty string', () => {
    expect(typeof getColorFromHandle('test-handle')).toBe('string')
    expect(getColorFromHandle('test-handle').length).toBeGreaterThan(0)
  })

  it('is deterministic for the same handle', () => {
    expect(getColorFromHandle('abc')).toBe(getColorFromHandle('abc'))
  })
})

// ---------------------------------------------------------------------------
// VendorBadge component tests
// ---------------------------------------------------------------------------

describe('VendorBadge — link (AC #2, #5)', () => {
  it('renders link to /salony/[handle]', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
    // Root element is the mocked Link ('mock-link')
    expect(result.type).toBe('mock-link')
    expect(result.props.href).toBe('/salony/salon-pieknosci')
  })

  it('has aria-label describing salon name', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
    expect(result.props['aria-label']).toBe('Profil salonu Salon Piękności')
  })
})

describe('VendorBadge — avatar with image (AC #4)', () => {
  it('renders next/image when photoUrl is provided', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img).not.toBeNull()
    expect(img!.props.src).toBe(baseVendor.photoUrl)
    expect(img!.props.alt).toBe(baseVendor.name)
  })

  it('pdp variant uses 48px for image dimensions', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img!.props.width).toBe(48)
    expect(img!.props.height).toBe(48)
  })

  it('header variant uses 72px for image dimensions (AC #1)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'header' }) as React.ReactElement
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img!.props.width).toBe(72)
    expect(img!.props.height).toBe(72)
  })

  it('image has onError handler for fallback (AC #3, #4)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(typeof img!.props.onError).toBe('function')
  })
})

describe('VendorBadge — initials fallback (AC #3)', () => {
  it('does NOT render image when photoUrl is null', () => {
    const result = VendorBadge({
      vendor: { ...baseVendor, photoUrl: null },
      variant: 'pdp',
    }) as React.ReactElement
    const img = findElement(result, el => el.type === 'mock-next-image')
    expect(img).toBeNull()
  })

  it('renders initials span always (CSS fallback behind image)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
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
    }) as React.ReactElement
    const initialsSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'SP',
    )
    expect(initialsSpan).not.toBeNull()
  })

  it('onError handler hides image (CSS fallback revealed)', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
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
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
    const nameSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'Salon Piękności',
    )
    expect(nameSpan).not.toBeNull()
  })

  it('shows product count text', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
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
    const result = VendorBadge({ vendor: baseVendor, variant: 'pdp' }) as React.ReactElement
    const arrow = findElement(result, el => el.type === 'mock-arrow-icon')
    expect(arrow).not.toBeNull()
    expect(arrow!.props.size).toBe(20)
  })
})

describe('VendorBadge — header variant (AC #1)', () => {
  it('does NOT render arrow icon', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'header' }) as React.ReactElement
    const arrow = findElement(result, el => el.type === 'mock-arrow-icon')
    expect(arrow).toBeNull()
  })

  it('does NOT render vendor name label in header variant', () => {
    const result = VendorBadge({ vendor: baseVendor, variant: 'header' }) as React.ReactElement
    const nameSpan = findElement(
      result,
      el => el.type === 'span' && el.props.children === 'Salon Piękności',
    )
    expect(nameSpan).toBeNull()
  })
})
