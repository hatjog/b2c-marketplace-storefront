const STORAGE_KEY_PREFIX = 'gp.checkout.payment_idempotency_uuid';
const processFallbackKeys = new Map<string, string>();

export type CheckoutCartFingerprintInput = {
  id?: string | null;
  currency_code?: string | null;
  total?: number | null;
  item_total?: number | null;
  shipping_total?: number | null;
  tax_total?: number | null;
};

function uuidFromRandomValues(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

function storageKeyForPaymentRequest(
  cartId?: string | null,
  cartHash?: string | null,
  providerId?: string | null
): string {
  // Stripe accepts a key only for an identical request. `cart.id` alone is not
  // that boundary: totals and provider may change while the cart survives.
  const normalizedHash = cartHash?.trim();
  if (!normalizedHash) {
    throw new Error('Checkout payment fingerprint is required');
  }
  return `${STORAGE_KEY_PREFIX}:${cartId?.trim() || 'unknown'}:${providerId?.trim() || 'unknown'}:${normalizedHash}`;
}

export function getCheckoutPaymentIdempotencyKey(
  cartId?: string | null,
  cartHash?: string | null,
  providerId?: string | null
): string {
  const storageKey = storageKeyForPaymentRequest(cartId, cartHash, providerId);
  if (typeof window === 'undefined') {
    const existing = processFallbackKeys.get(storageKey);
    if (existing) return existing;
    const next = uuidFromRandomValues();
    processFallbackKeys.set(storageKey, next);
    return next;
  }

  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const next =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : uuidFromRandomValues();
    window.sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    // Privacy modes may deny sessionStorage. Keep checkout usable, but do not
    // share a fallback key across carts or browser requests.
    const existing = processFallbackKeys.get(storageKey);
    if (existing) return existing;
    const next = uuidFromRandomValues();
    processFallbackKeys.set(storageKey, next);
    return next;
  }
}

export function resetCheckoutPaymentIdempotencyKey(cartId?: string | null): void {
  if (!cartId) {
    processFallbackKeys.clear();
    if (typeof window !== 'undefined') {
      try {
        for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
          const key = window.sessionStorage.key(index);
          if (key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
            window.sessionStorage.removeItem(key);
          }
        }
      } catch {
        // Storage cleanup is best-effort for the same reason as key creation.
      }
    }
    return;
  }

  const cartPrefix = `${STORAGE_KEY_PREFIX}:${cartId.trim()}:`;
  for (const key of processFallbackKeys.keys()) {
    if (key.startsWith(cartPrefix)) processFallbackKeys.delete(key);
  }
  if (typeof window !== 'undefined') {
    try {
      for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = window.sessionStorage.key(index);
        if (key?.startsWith(cartPrefix)) window.sessionStorage.removeItem(key);
      }
    } catch {
      // Same fail-open policy as key creation: denied storage cannot make a
      // completed payment look failed to the buyer.
    }
  }
}

export async function computeCheckoutCartHash(cart: CheckoutCartFingerprintInput): Promise<string> {
  const canonical = JSON.stringify({
    cart_id: cart.id ?? null,
    currency_code: cart.currency_code ?? null,
    item_total: cart.item_total ?? null,
    shipping_total: cart.shipping_total ?? null,
    tax_total: cart.tax_total ?? null,
    total: cart.total ?? null
  });

  if (!globalThis.crypto?.subtle) {
    // This is a request fingerprint, not a secret. It MUST stay non-empty so
    // the backend reconciliation lock and Stripe key share one boundary even
    // on HTTP/LAN development origins without Web Crypto.
    let hash = 0x811c9dc5;
    for (let index = 0; index < canonical.length; index += 1) {
      hash ^= canonical.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
