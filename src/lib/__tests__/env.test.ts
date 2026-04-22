import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env validation', () => {
  const originalEnv = process.env
  const localBackendUrl = 'http://localhost:9002'
  const storefrontUrl = 'http://localhost:3002'

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('uses MEDUSA_URL when MEDUSA_BACKEND_URL is missing', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    process.env.MEDUSA_URL = localBackendUrl
    process.env.STOREFRONT_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(env.resolveMedusaBackendUrl()).toBe(localBackendUrl)
  })

  it('uses NEXT_PUBLIC_BASE_URL when STOREFRONT_BASE_URL is missing', async () => {
    process.env.MEDUSA_BACKEND_URL = localBackendUrl
    delete process.env.STOREFRONT_BASE_URL
    process.env.NEXT_PUBLIC_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(env.resolveStorefrontBaseUrl()).toBe(storefrontUrl)
  })

  it('uses the local backend default in development when backend env vars are missing', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    delete process.env.MEDUSA_URL
    vi.stubEnv('NODE_ENV', 'development')
    process.env.STOREFRONT_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(env.resolveMedusaBackendUrl()).toBe(localBackendUrl)
  })

  it('throws when backend url sources are missing outside development', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    delete process.env.MEDUSA_URL
    vi.stubEnv('NODE_ENV', 'production')
    process.env.STOREFRONT_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(() => env.resolveMedusaBackendUrl()).toThrow('MEDUSA_BACKEND_URL')
  })

  it('throws when storefront url sources are missing', async () => {
    process.env.MEDUSA_BACKEND_URL = localBackendUrl
    delete process.env.STOREFRONT_BASE_URL
    delete process.env.NEXT_PUBLIC_BASE_URL

    const env = await import('../env')

    expect(() => env.resolveStorefrontBaseUrl()).toThrow('STOREFRONT_BASE_URL')
  })

  it('error message contains helpful hint about .env.local', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    delete process.env.MEDUSA_URL
    vi.stubEnv('NODE_ENV', 'production')
    process.env.STOREFRONT_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(() => env.resolveMedusaBackendUrl()).toThrow('.env.local')
  })

  it('validates startup when backend and storefront aliases are set', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    process.env.MEDUSA_URL = localBackendUrl
    delete process.env.STOREFRONT_BASE_URL
    process.env.NEXT_PUBLIC_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(() => env.validateStorefrontEnv()).not.toThrow()
  })
})
