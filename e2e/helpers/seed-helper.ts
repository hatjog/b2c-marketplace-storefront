/**
 * Seed helper — Story v160-8-8
 *
 * Verifies that BB market test data is present via backend probes.
 * Does NOT seed data programmatically — seeding is done via gp-ops
 * materialization per pre-promote smoke checklist.
 *
 * @see specs/operator/pre-promote-smoke-checklist.md
 */

const BACKEND_BASE = process.env.BACKEND_BASE_URL ?? "http://localhost:9002"

// Story v160-cleanup-13a — publishable-api-key is required for /store/* in
// Mercur 2.1.1. Without it the store routes return 400 not_allowed and the
// helper sees empty products (false-negative DEFERRED).
const PUBLISHABLE_KEY =
  process.env.E2E_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
  // Default seeded BB market publishable key (matches gp-config + .env.local)
  "pk_73cc512f8b76b8aed24c0dbf855b19388347822946480b8e6207684769ceb0f9"

const STORE_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "x-publishable-api-key": PUBLISHABLE_KEY,
}

// Optional explicit region. When absent, prefer country_code=pl because local
// Medusa seeds generate dynamic region IDs.
const REGION_ID = process.env.E2E_REGION_ID
const COUNTRY_CODE = process.env.E2E_COUNTRY_CODE ?? "pl"

export interface SellerSummary {
  id: string
  handle: string
  name: string
}

export interface ProductSummary {
  id: string
  handle: string
  title: string
  seller?: { handle: string }
  /** Multi-vendor resolver fields (cleanup-12a). */
  vendor_count?: number
  vendor_offers?: Array<{
    seller_id: string
    seller_handle: string
    seller_name: string
  }>
}

/**
 * Fetch sellers from the store API.
 * Returns empty array if endpoint not available (DEFERRED scenario).
 */
export async function fetchSellers(): Promise<SellerSummary[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/store/sellers`, {
      headers: STORE_HEADERS,
    })
    if (!res.ok) return []
    const body = (await res.json()) as {
      sellers?: SellerSummary[]
      data?: SellerSummary[]
    }
    return body.sellers ?? body.data ?? []
  } catch {
    return []
  }
}

/**
 * Fetch products from the store API (first page) with multi-vendor metadata
 * fields preserved (cleanup-12a contract).
 */
export async function fetchProducts(): Promise<ProductSummary[]> {
  try {
    const pricingContext = REGION_ID
      ? `region_id=${encodeURIComponent(REGION_ID)}`
      : `country_code=${encodeURIComponent(COUNTRY_CODE)}`
    const res = await fetch(
      `${BACKEND_BASE}/store/products?limit=50&${pricingContext}&fields=handle,title,vendor_count,vendor_offers,*seller`,
      { headers: STORE_HEADERS },
    )
    if (!res.ok) return []
    const body = (await res.json()) as {
      products?: ProductSummary[]
      data?: ProductSummary[]
    }
    return body.products ?? body.data ?? []
  } catch {
    return []
  }
}

/**
 * Probe the backend health endpoint.
 */
export async function probeBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Probe the storefront (via relative or absolute URL).
 */
export async function probeStorefront(
  path: string,
  baseUrl = "http://localhost:8000",
): Promise<{ ok: boolean; status: number }> {
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`
  try {
    const res = await fetch(url, { redirect: "follow" })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

/**
 * Assert that backend has at least minCount sellers.
 * If not, returns a structured DEFERRED result instead of throwing.
 */
export async function assertMinSellers(
  minCount: number,
): Promise<{ pass: boolean; count: number; deferred: boolean }> {
  const sellers = await fetchSellers()
  return {
    pass: sellers.length >= minCount,
    count: sellers.length,
    deferred: sellers.length === 0,
  }
}

/**
 * Find the first product whose handle can be used for PDP testing.
 */
export async function findTestProductHandle(): Promise<string | null> {
  const products = await fetchProducts()
  if (products.length === 0) return null
  return products[0].handle
}

/**
 * Find products from at least minSellerCount distinct sellers.
 * Returns null if not enough sellers found.
 */
export async function findProductsFromMultipleSellers(
  minSellerCount: number,
): Promise<{ productHandles: string[]; sellerHandles: string[] } | null> {
  const products = await fetchProducts()

  // Story v160-cleanup-13a — preferred path: use the cleanup-12a contract.
  // Each product carries `vendor_count` and `vendor_offers[]` when ≥2 sellers
  // are linked. Pick products where vendor_count >= minSellerCount and use
  // their `vendor_offers` to enumerate distinct seller handles.
  const overlap = products.filter(
    (p) => (p.vendor_count ?? 0) >= minSellerCount && Array.isArray(p.vendor_offers),
  )
  if (overlap.length > 0) {
    const productHandles = overlap.map((p) => p.handle).filter(Boolean)
    const sellerHandles = Array.from(
      new Set(
        overlap.flatMap(
          (p) => p.vendor_offers?.map((o) => o.seller_handle).filter(Boolean) ?? [],
        ),
      ),
    )
    if (sellerHandles.length >= minSellerCount) {
      return { productHandles, sellerHandles }
    }
  }

  // Fallback (legacy single-seller schema): one product per seller-handle.
  const bySellerHandle = new Map<string, string>()
  for (const p of products) {
    const sellerHandle = p.seller?.handle
    if (sellerHandle && !bySellerHandle.has(sellerHandle)) {
      bySellerHandle.set(sellerHandle, p.handle)
    }
  }
  if (bySellerHandle.size < minSellerCount) return null
  const sellerHandles: string[] = []
  const productHandles: string[] = []
  for (const [seller, product] of bySellerHandle.entries()) {
    sellerHandles.push(seller)
    productHandles.push(product)
    if (sellerHandles.length >= minSellerCount) break
  }
  return { productHandles, sellerHandles }
}
