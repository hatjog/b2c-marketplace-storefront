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
}

/**
 * Fetch sellers from the store API.
 * Returns empty array if endpoint not available (DEFERRED scenario).
 */
export async function fetchSellers(): Promise<SellerSummary[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/store/sellers`, {
      headers: { Accept: "application/json" },
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
 * Fetch products from the store API (first page).
 */
export async function fetchProducts(): Promise<ProductSummary[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/store/products?limit=50`, {
      headers: { Accept: "application/json" },
    })
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
