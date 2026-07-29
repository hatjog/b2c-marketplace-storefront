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

function storageKeyForCart(cartId?: string | null): string {
  // A key may only be reused with identical Stripe request parameters. A cart
  // is the smallest stable checkout boundary available at both call sites.
  return `${STORAGE_KEY_PREFIX}:${cartId?.trim() || 'unknown'}`;
}

export function getCheckoutPaymentIdempotencyKey(cartId?: string | null): string {
  const storageKey = storageKeyForCart(cartId);
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
  const storageKey = storageKeyForCart(cartId);
  processFallbackKeys.delete(storageKey);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(storageKey);
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
    // The hash only scopes our idempotency lookup. HTTP origins without Web
    // Crypto must not turn the checkout button into a dead end.
    return '';
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
