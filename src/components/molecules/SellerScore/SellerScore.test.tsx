import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'seller_score') return 'Ocena sprzedawcy'
    if (key === 'reviews_count') return `${params?.count} opinii`
    return key
  },
}))

vi.mock('@/components/atoms', () => ({
  StarRating: 'mock-star-rating',
}))

import { SellerScore } from './SellerScore'

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

function findText(element: React.ReactElement, text: string): boolean {
  if (!React.isValidElement(element)) return false
  const el = element as React.ReactElement<Record<string, unknown>>
  if (el.props?.children === text) return true
  const children = React.Children.toArray(el.props?.children ?? [])
  for (const child of children) {
    if (child === text) return true
    if (React.isValidElement(child) && findText(child as React.ReactElement, text)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Tests: NaN guard (AC1, AC2)
// ---------------------------------------------------------------------------

describe('SellerScore — NaN rate (AC1, AC2)', () => {
  it('displays "–" instead of "NaN" when rate is NaN', () => {
    const result = SellerScore({ rate: NaN, reviewCount: 0 }) as React.ReactElement
    expect(findText(result, '–')).toBe(true)
  })

  it('does NOT display "NaN" when rate is NaN', () => {
    const result = SellerScore({ rate: NaN, reviewCount: 0 }) as React.ReactElement
    expect(findText(result, 'NaN')).toBe(false)
  })

  it('passes rate=0 to StarRating when rate is NaN (AC2)', () => {
    const result = SellerScore({ rate: NaN, reviewCount: 0 }) as React.ReactElement
    const star = findElement(result, el => el.type === 'mock-star-rating')
    expect(star).not.toBeNull()
    expect(star!.props.rate).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Tests: normal rate (AC3)
// ---------------------------------------------------------------------------

describe('SellerScore — normal rate (AC3)', () => {
  it('displays "4.2" for rate=4.2', () => {
    const result = SellerScore({ rate: 4.2, reviewCount: 10 }) as React.ReactElement
    expect(findText(result, '4.2')).toBe(true)
  })

  it('passes rate=4.2 to StarRating unchanged', () => {
    const result = SellerScore({ rate: 4.2, reviewCount: 10 }) as React.ReactElement
    const star = findElement(result, el => el.type === 'mock-star-rating')
    expect(star!.props.rate).toBe(4.2)
  })
})

// ---------------------------------------------------------------------------
// Tests: zero rate (AC4)
// ---------------------------------------------------------------------------

describe('SellerScore — zero rate (AC4)', () => {
  it('displays "0.0" for rate=0', () => {
    const result = SellerScore({ rate: 0, reviewCount: 0 }) as React.ReactElement
    expect(findText(result, '0.0')).toBe(true)
  })

  it('passes rate=0 to StarRating for rate=0', () => {
    const result = SellerScore({ rate: 0, reviewCount: 0 }) as React.ReactElement
    const star = findElement(result, el => el.type === 'mock-star-rating')
    expect(star!.props.rate).toBe(0)
  })
})
