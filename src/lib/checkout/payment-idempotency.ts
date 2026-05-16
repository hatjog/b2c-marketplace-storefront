const STORAGE_KEY = 'gp.checkout.payment_idempotency_uuid';
let processFallbackKey: string | null = null;

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

export function getCheckoutPaymentIdempotencyKey(): string {
  if (typeof window === 'undefined') {
    processFallbackKey ??= uuidFromRandomValues();
    return processFallbackKey;
  }

  const existing = window.sessionStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const next =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : uuidFromRandomValues();
  window.sessionStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function resetCheckoutPaymentIdempotencyKey(): void {
  processFallbackKey = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY);
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

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
