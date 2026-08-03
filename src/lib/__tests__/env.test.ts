import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env validation', () => {
  const originalEnv = process.env
  const localBackendUrl = 'http://localhost:9002'
  const storefrontUrl = 'http://localhost:3002'

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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

/**
 * Story 7.2 (Stream A — ra-1 Gate A) — client backend URL inlining contract.
 *
 * AC1 (FR3/NFR5): w prod-build kod klienta MUSI rozwiązywać backend URL przez
 * `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (literalne inlining), a server-only zmienne
 * (`MEDUSA_BACKEND_URL` / `MEDUSA_URL` bez prefiksu `NEXT_PUBLIC_`) NIE mogą
 * wyciekać do client bundlu. Root-cause (v1.10.0 ra-1): klient czytał
 * server-only `MEDUSA_BACKEND_URL` ⇒ `undefined` w bundlu ⇒ runtime `500` na
 * `:3002/pl`. Fix utrwalony (#112) — te testy blokują kontrakt jako audytowalny
 * gate (determinizm prod-build evidence / C8) bez zależności od live-stacku.
 */
describe('client backend URL inlining contract (Story 7.2, FR3/NFR5)', () => {
  const originalEnv = process.env
  const publicBackendUrl = 'https://api.bonbeauty.example'
  const storefrontUrl = 'http://localhost:3002'

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = originalEnv
  })

  it('falls back to NEXT_PUBLIC_MEDUSA_BACKEND_URL when server-only vars are absent (client-bundle scenario)', async () => {
    // W client bundlu Next NIE inline'uje server-only `MEDUSA_BACKEND_URL` /
    // `MEDUSA_URL` (dynamiczny odczyt `process.env[name]` ⇒ `undefined`); jedyną
    // wartością widoczną po stronie klienta jest literalne
    // `NEXT_PUBLIC_MEDUSA_BACKEND_URL`. Symulujemy to brakiem server-only var.
    delete process.env.MEDUSA_BACKEND_URL
    delete process.env.MEDUSA_URL
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = publicBackendUrl
    process.env.STOREFRONT_BASE_URL = storefrontUrl

    const env = await import('../env')

    // Brak `500`/throw z powodu `undefined` backend URL po stronie klienta.
    expect(env.resolveMedusaBackendUrl()).toBe(publicBackendUrl)
  })

  it('normalizes a trailing-slash NEXT_PUBLIC_MEDUSA_BACKEND_URL (same as server vars)', async () => {
    delete process.env.MEDUSA_BACKEND_URL
    delete process.env.MEDUSA_URL
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = `${publicBackendUrl}/`
    process.env.STOREFRONT_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(env.resolveMedusaBackendUrl()).toBe(publicBackendUrl)
  })

  it('server-only vars take precedence over the public fallback (no behaviour regression server-side)', async () => {
    process.env.MEDUSA_BACKEND_URL = 'http://server-only:9002'
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = publicBackendUrl
    process.env.STOREFRONT_BASE_URL = storefrontUrl

    const env = await import('../env')

    expect(env.resolveMedusaBackendUrl()).toBe('http://server-only:9002')
  })

  it('reads NEXT_PUBLIC_MEDUSA_BACKEND_URL as a STATIC literal so Next inlines it (NFR5 boundary lock)', () => {
    // Next.js inline'uje TYLKO statyczne literały `process.env.NEXT_PUBLIC_*`.
    // Server-only zmienne MUSZĄ być czytane dynamicznie (`process.env[name]`),
    // bo dynamiczny odczyt NIE jest inline'owany ⇒ wartość server-only nie
    // trafia do client bundlu (NFR5 — brak leaku). Statyczny skan źródła
    // `env.ts` blokuje ten kontrakt bez `next build` (C8 determinizm).
    //
    // KNOWN LIMITATION (L2): ten guard działa na surowym tekście pliku
    // (łącznie z komentarzami). Refaktor do notacji bracket-string
    // (`process.env["MEDUSA_BACKEND_URL"]`) lub przeniesienie odczytu
    // do innej zmiennej poza `env.ts` ominąłby ten guard bez realnej
    // zmiany semantyki. Docelowym rozwiązaniem jest skan artefaktu
    // `.next/static` z `next build` (M1 — deferred: live-evidence ra-1 7-6).
    const source = readFileSync(
      fileURLToPath(new URL('../env.ts', import.meta.url)),
      'utf8'
    )

    // FR3: public backend URL czytany jako literał → inlining w client bundlu.
    expect(source).toContain('process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL')

    // NFR5: server-only `MEDUSA_BACKEND_URL`/`MEDUSA_URL` NIE mogą być czytane
    // jako statyczny literał `process.env.MEDUSA_BACKEND_URL` (zostałyby
    // potraktowane przez Next jako inline-candidate). Dozwolony jest wyłącznie
    // dynamiczny odczyt przez `readEnv(...)` (`process.env[name]`).
    // Note: guard covers only env.ts — whole-bundle scan deferred (see above).
    expect(source).not.toContain('process.env.MEDUSA_BACKEND_URL')
    expect(source).not.toContain('process.env.MEDUSA_URL')
  })
})
