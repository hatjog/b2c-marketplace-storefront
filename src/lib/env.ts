const LOCAL_MEDUSA_BACKEND_URL = 'http://localhost:9002'

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value.replace(/\/+$/, '') : undefined
}

function missingEnvError(primaryName: string, fallbackNames: string[]): Error {
  const acceptedNames = [primaryName, ...fallbackNames].join(' or ')

  return new Error(
    `Missing required environment variable: ${primaryName}. ` +
      `Set ${acceptedNames} in .env.local (see .env.template for reference).`
  )
}

// Next.js only inlines NEXT_PUBLIC_* env vars into the client bundle when they
// are accessed as a STATIC literal (`process.env.NEXT_PUBLIC_FOO`). The dynamic
// `readEnv(name)` (`process.env[name]`) is NOT inlined, so any client component
// that transitively reaches these helpers would otherwise see `undefined` and
// throw "Missing MEDUSA_BACKEND_URL" at hydration → the app 500 error boundary.
// We therefore add explicit literal NEXT_PUBLIC_ fallbacks (same normalization
// as readEnv). Server keeps preferring the non-public vars.
function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined
}

export function resolveMedusaBackendUrl(): string {
  const value =
    readEnv('MEDUSA_BACKEND_URL') ??
    readEnv('MEDUSA_URL') ??
    normalizeEnvValue(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL)

  if (value) {
    return value
  }

  if (process.env.NODE_ENV === 'development') {
    return LOCAL_MEDUSA_BACKEND_URL
  }

  throw missingEnvError('MEDUSA_BACKEND_URL', ['MEDUSA_URL', 'NEXT_PUBLIC_MEDUSA_BACKEND_URL'])
}

export function buildMedusaUrl(pathname: string): URL {
  const baseUrl = resolveMedusaBackendUrl()
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  return new URL(pathname.replace(/^\//, ''), normalizedBase)
}

export function resolveStorefrontBaseUrl(): string {
  // Literal NEXT_PUBLIC_BASE_URL so it inlines client-side (see note above).
  const value =
    readEnv('STOREFRONT_BASE_URL') ??
    normalizeEnvValue(process.env.NEXT_PUBLIC_BASE_URL)

  if (value) {
    return value
  }

  throw missingEnvError('STOREFRONT_BASE_URL', ['NEXT_PUBLIC_BASE_URL'])
}

export function validateStorefrontEnv(): void {
  resolveMedusaBackendUrl()
  resolveStorefrontBaseUrl()
}
