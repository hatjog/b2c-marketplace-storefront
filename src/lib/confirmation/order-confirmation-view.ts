/**
 * v1.15.0 Story 3.7 — czyste pomocniki widoku potwierdzenia.
 *
 * Wydzielone z `ConfirmationPageContent.tsx` bez zmiany zachowania, bo ta story
 * rozbija tamten komponent na LISTĘ zakupu i KARTĘ pojedynczego zamówienia.
 * Wspólne typy i funkcje muszą mieć jedno miejsce, żeby rozjazd między listą
 * a kartą nie był możliwy.
 */

export type OrderItem = {
  id: string | null;
  title: string | null;
  quantity: number;
  subtotal: number;
  total: number;
  unit_price: number;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
};

export type ShippingMethod = {
  id: string | null;
  name: string | null;
};

export type OrderData = {
  id: string;
  display_id: string | null;
  payment_status: string | null;
  updated_at: string | null;
  customer_id: string | null;
  masked_email: string | null;
  is_guest_checkout: boolean;
  currency_code: string | null;
  item_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  items: OrderItem[];
  shipping_methods: ShippingMethod[];
};

export type PaymentStatusData = {
  status?: string;
  last_checked_at?: string;
  recommended_action_key?: string;
};

export type EntitlementData = {
  status?: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  issued_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  opened_at?: string | null;
};

export function localeTag(locale: string): string {
  switch (locale) {
    case 'en':
      return 'en-GB';
    case 'ua':
      return 'uk-UA';
    case 'de':
      return 'de-DE';
    default:
      return 'pl-PL';
  }
}

/**
 * L2 fix: validate URL scheme before embedding in CSS background-image.
 * Only http: and https: URLs are allowed (defense-in-depth — CSS background-image
 * does not execute javascript: but we reject non-http schemes to prevent
 * data: URL leakage and future attack vectors).
 */
export function toCssImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
  } catch {
    return null;
  }

  return `url("${url.replace(/["\\]/g, '\\$&')}")`;
}

/**
 * L3 fix: also check metadata.gp sub-object so gift detection is consistent
 * with readMetadataString in order-confirmed-surface.ts (which already checks .gp).
 */
export function readString(metadata: Record<string, unknown> | null, keys: string[]): string | null {
  if (!metadata) return null;

  for (const key of keys) {
    const directValue = metadata[key];
    if (typeof directValue === 'string' && directValue.trim().length > 0) {
      return directValue.trim();
    }

    const gp = metadata.gp;
    if (typeof gp === 'object' && gp !== null && !Array.isArray(gp)) {
      const gpValue = (gp as Record<string, unknown>)[key];
      if (typeof gpValue === 'string' && gpValue.trim().length > 0) {
        return gpValue.trim();
      }
    }
  }

  return null;
}

export function isGiftOrder(order: OrderData, entitlements: EntitlementData[]): boolean {
  if (entitlements.some(ent => String(ent.status ?? '').toUpperCase() === 'ISSUED')) {
    return true;
  }

  return order.items.some(item => {
    const purchaseMode = readString(item.metadata, ['purchase_mode', 'gift_mode']);
    if (purchaseMode && purchaseMode.toLowerCase() === 'gift') {
      return true;
    }

    const recipientName = readString(item.metadata, ['recipient_name', 'gift_recipient_name']);
    const recipientEmail = readString(item.metadata, ['recipient_email', 'gift_recipient_email']);

    return Boolean(recipientName || recipientEmail);
  });
}

export function resolveRecipient(
  order: OrderData,
  entitlements: EntitlementData[]
): { name: string | null; email: string | null } {
  for (const ent of entitlements) {
    if (ent.recipient_name || ent.recipient_email) {
      return {
        name: ent.recipient_name ?? null,
        email: ent.recipient_email ?? null
      };
    }
  }

  for (const item of order.items) {
    const name = readString(item.metadata, ['recipient_name', 'gift_recipient_name']);
    const email = readString(item.metadata, ['recipient_email', 'gift_recipient_email']);
    if (name || email) {
      return { name, email };
    }
  }

  return { name: null, email: null };
}

export function resolveDeliveryMethod(order: OrderData): 'email' | 'scheduled' | 'physical' {
  for (const item of order.items) {
    const metadataMethod = readString(item.metadata, [
      'delivery_method',
      'voucher_delivery_method',
      'delivery_type'
    ]);

    if (metadataMethod) {
      const normalized = metadataMethod.toLowerCase();
      if (normalized.includes('sched')) return 'scheduled';
      if (normalized.includes('physical') || normalized.includes('courier')) return 'physical';
      if (normalized.includes('email') || normalized.includes('mail')) return 'email';
    }
  }

  const shippingName = order.shipping_methods[0]?.name?.toLowerCase() ?? '';
  if (
    shippingName.includes('kurier') ||
    shippingName.includes('courier') ||
    shippingName.includes('ship')
  ) {
    return 'physical';
  }

  return 'email';
}
