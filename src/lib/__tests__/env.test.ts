import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when MEDUSA_BACKEND_URL is missing', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    process.env.STOREFRONT_BASE_URL = 'http://localhost:3000'
    await expect(import('../env')).rejects.toThrow('MEDUSA_BACKEND_URL')
  })

  it('throws when STOREFRONT_BASE_URL is missing', async () => {
    process.env.MEDUSA_BACKEND_URL = 'http://localhost:9002'
    delete process.env.STOREFRONT_BASE_URL
    await expect(import('../env')).rejects.toThrow('STOREFRONT_BASE_URL')
  })

  it('error message contains helpful hint about .env.local', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    process.env.STOREFRONT_BASE_URL = 'http://localhost:3000'
    await expect(import('../env')).rejects.toThrow('.env.local')
  })

  it('does not throw when both required vars are set', async () => {
    process.env.MEDUSA_BACKEND_URL = 'http://localhost:9002'
    process.env.STOREFRONT_BASE_URL = 'http://localhost:3000'
    const env = await import('../env')
    expect(env.MEDUSA_BACKEND_URL).toBe('http://localhost:9002')
    expect(env.STOREFRONT_BASE_URL).toBe('http://localhost:3000')
  })
})
