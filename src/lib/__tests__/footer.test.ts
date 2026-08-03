import { describe, it, expect } from 'vitest'
import { resolveFooterLegalEntity } from '../footer'

const VALID_ENTITY = {
  name: 'Bonbeauty Sp. z o.o.',
  address: 'ul. Handlowa 10, 00-001 Warszawa',
  tax_id: 'PL1234567890',
  email: 'contact@bonbeauty.pl',
  phone: '+48222333444'
}

describe('resolveFooterLegalEntity', () => {
  it('returns null when marketConfig is null', () => {
    expect(resolveFooterLegalEntity(null)).toBeNull()
  })

  it('returns null when marketConfig is undefined', () => {
    expect(resolveFooterLegalEntity(undefined)).toBeNull()
  })

  it('returns null when legal_entity is absent', () => {
    expect(resolveFooterLegalEntity({})).toBeNull()
  })

  it('returns null when legal_entity is null', () => {
    expect(resolveFooterLegalEntity({ legal_entity: null })).toBeNull()
  })

  it('returns null when required field name is missing', () => {
    const entity = { ...VALID_ENTITY, name: '' }
    expect(resolveFooterLegalEntity({ legal_entity: entity })).toBeNull()
  })

  it('returns null when required field address is missing', () => {
    const entity = { ...VALID_ENTITY, address: '   ' }
    expect(resolveFooterLegalEntity({ legal_entity: entity })).toBeNull()
  })

  it('returns null when required field tax_id is missing', () => {
    const entity = { ...VALID_ENTITY, tax_id: '' }
    expect(resolveFooterLegalEntity({ legal_entity: entity })).toBeNull()
  })

  it('returns normalized entity with all required fields', () => {
    const result = resolveFooterLegalEntity({ legal_entity: VALID_ENTITY })
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Bonbeauty Sp. z o.o.')
    expect(result?.address).toBe('ul. Handlowa 10, 00-001 Warszawa')
    expect(result?.tax_id).toBe('PL1234567890')
  })

  it('trims whitespace from fields', () => {
    const entity = {
      name: '  Firma ABC  ',
      address: '  ul. Testowa 1  ',
      tax_id: '  PL9876543210  '
    }
    const result = resolveFooterLegalEntity({ legal_entity: entity })
    expect(result?.name).toBe('Firma ABC')
    expect(result?.address).toBe('ul. Testowa 1')
    expect(result?.tax_id).toBe('PL9876543210')
  })

  it('returns email when present', () => {
    const result = resolveFooterLegalEntity({ legal_entity: VALID_ENTITY })
    expect(result?.email).toBe('contact@bonbeauty.pl')
  })

  it('returns phone when present', () => {
    const result = resolveFooterLegalEntity({ legal_entity: VALID_ENTITY })
    expect(result?.phone).toBe('+48222333444')
  })

  it('returns null for email when absent', () => {
    const entity = { ...VALID_ENTITY, email: null }
    const result = resolveFooterLegalEntity({ legal_entity: entity })
    expect(result?.email).toBeNull()
  })

  it('returns null for phone when absent', () => {
    const entity = { ...VALID_ENTITY, phone: null }
    const result = resolveFooterLegalEntity({ legal_entity: entity })
    expect(result?.phone).toBeNull()
  })

  it('returns null for email when empty string', () => {
    const entity = { ...VALID_ENTITY, email: '   ' }
    const result = resolveFooterLegalEntity({ legal_entity: entity })
    expect(result?.email).toBeNull()
  })

  it('does not expose bank_account field', () => {
    const entity = { ...VALID_ENTITY, bank_account: 'PL61109010140000071219812874' }
    const result = resolveFooterLegalEntity({ legal_entity: entity })
    expect(result).not.toHaveProperty('bank_account')
  })
})
