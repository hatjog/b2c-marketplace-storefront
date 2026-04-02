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

export function resolveMedusaBackendUrl(): string {
  const value = readEnv('MEDUSA_BACKEND_URL') ?? readEnv('MEDUSA_URL')

  if (value) {
    return value
  }

  if (process.env.NODE_ENV === 'development') {
    return LOCAL_MEDUSA_BACKEND_URL
  }

  throw missingEnvError('MEDUSA_BACKEND_URL', ['MEDUSA_URL'])
}

export function buildMedusaUrl(pathname: string): URL {
  const baseUrl = resolveMedusaBackendUrl()
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  return new URL(pathname.replace(/^\//, ''), normalizedBase)
}

export function resolveStorefrontBaseUrl(): string {
  const value = readEnv('STOREFRONT_BASE_URL') ?? readEnv('NEXT_PUBLIC_BASE_URL')

  if (value) {
    return value
  }

  throw missingEnvError('STOREFRONT_BASE_URL', ['NEXT_PUBLIC_BASE_URL'])
}

export function validateStorefrontEnv(): void {
  resolveMedusaBackendUrl()
  resolveStorefrontBaseUrl()
}
