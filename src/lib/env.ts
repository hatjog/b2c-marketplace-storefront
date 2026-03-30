// Fail-fast env validation: throws at module load if required vars are missing.
// Storefront uses server components only, so MEDUSA_BACKEND_URL (no NEXT_PUBLIC_ prefix)
// is the correct choice — consistent with lib/config.ts. See story Dev Notes for rationale.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (see .env.template for reference).`
    )
  }
  return value
}

export const MEDUSA_BACKEND_URL = requireEnv('MEDUSA_BACKEND_URL')
export const STOREFRONT_BASE_URL = requireEnv('STOREFRONT_BASE_URL')
