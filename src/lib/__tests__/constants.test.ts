import { describe, it, expect } from 'vitest'
import {
  ISR_TTL,
  SORT_OPTIONS,
  SELLER_SERVICE_LIST_PAGE_SIZE,
  TRUST_SIGNALS_MAX,
  CROSS_SELL_MAX
} from '../constants'

describe('constants', () => {
  it('ISR_TTL should be 60 seconds', () => {
    expect(ISR_TTL).toBe(60)
  })

  it('SORT_OPTIONS should include all required options', () => {
    expect(SORT_OPTIONS).toContain('recommended')
    expect(SORT_OPTIONS).toContain('price_asc')
    expect(SORT_OPTIONS).toContain('price_desc')
  })

  it('SORT_OPTIONS should have exactly 3 entries', () => {
    expect(SORT_OPTIONS).toHaveLength(3)
  })

  it('SELLER_SERVICE_LIST_PAGE_SIZE should be 10', () => {
    expect(SELLER_SERVICE_LIST_PAGE_SIZE).toBe(10)
  })

  it('TRUST_SIGNALS_MAX should be 3', () => {
    expect(TRUST_SIGNALS_MAX).toBe(3)
  })

  it('CROSS_SELL_MAX should be 4', () => {
    expect(CROSS_SELL_MAX).toBe(4)
  })
})
