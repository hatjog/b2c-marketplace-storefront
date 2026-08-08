export type OrderConfirmedItemMetadata = Record<string, unknown> | null;

export type OrderConfirmedSurfaceItem = {
  title: string | null;
  thumbnail?: string | null;
  metadata: OrderConfirmedItemMetadata;
};

export type GiftCue = {
  recipient: string;
  message: string | null;
};

export type VoucherRuleBadges = {
  validity: string | null;
  refund: string | null;
};

const GIFT_MESSAGE_KEYS = [
  'gift_recipient_message',
  'recipient_message',
  'gift_message',
  'sender_message'
];

const VALIDITY_KEYS = ['validity_period', 'voucher_validity_period', 'valid_until', 'expires_at'];
const REFUND_KEYS = ['refund_policy', 'return_policy', 'withdrawal_policy'];
const THUMBNAIL_KEYS = ['thumbnail', 'image', 'image_url', 'product_thumbnail', 'voucher_thumbnail'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readMetadataString(
  metadata: OrderConfirmedItemMetadata,
  keys: string[]
): string | null {
  if (!metadata) return null;

  for (const key of keys) {
    const directValue = metadata[key];
    if (typeof directValue === 'string' && directValue.trim().length > 0) {
      return directValue.trim();
    }

    const gpValue = isRecord(metadata.gp) ? metadata.gp[key] : undefined;
    if (typeof gpValue === 'string' && gpValue.trim().length > 0) {
      return gpValue.trim();
    }
  }

  return null;
}

export function resolveGiftMessage(items: OrderConfirmedSurfaceItem[]): string | null {
  for (const item of items) {
    const message = readMetadataString(item.metadata, GIFT_MESSAGE_KEYS);
    if (message) return message;
  }

  return null;
}

export function resolveGiftCue(
  isGift: boolean,
  recipientDisplay: string,
  items: OrderConfirmedSurfaceItem[]
): GiftCue | null {
  if (!isGift) return null;

  return {
    recipient: recipientDisplay,
    message: resolveGiftMessage(items)
  };
}

export function resolveVoucherRuleBadges(
  item: OrderConfirmedSurfaceItem,
  defaultRefundLabel: string
): VoucherRuleBadges {
  return {
    validity: readMetadataString(item.metadata, VALIDITY_KEYS),
    refund: readMetadataString(item.metadata, REFUND_KEYS) ?? defaultRefundLabel
  };
}

export function resolveVoucherThumbnail(item: OrderConfirmedSurfaceItem): string | null {
  if (typeof item.thumbnail === 'string' && item.thumbnail.trim().length > 0) {
    return item.thumbnail.trim();
  }

  return readMetadataString(item.metadata, THUMBNAIL_KEYS);
}

/**
 * Jak KARTA zamówienia wypada dla nagłówka strony (review-fix MEDIUM-1).
 * `pending` znaczy „jeszcze nie wiadomo" — nie „w porządku".
 */
export type ConfirmationOrderOutcome = 'pending' | 'success' | 'failed';

export type ConfirmationHeroTone = 'success' | 'partial' | 'failure';

/**
 * Agregat stanu zakupu dla NAGŁÓWKA powierzchni potwierdzenia.
 *
 * Do tej poprawki hero renderował „✓ Zamówienie potwierdzone" BEZWARUNKOWO —
 * także nad kartą mówiącą „Płatność nie doszła do skutku. Zamówienie nie
 * zostało opłacone." Dwa sprzeczne zdania na tym samym ekranie, przy czym
 * sprzeczne było to WIĘKSZE, WYŻEJ i ze znakiem potwierdzenia. Stan
 * `payment_failed` na tej powierzchni nie istniał przed Story 3.7, więc
 * sprzeczność weszła RAZEM z nią.
 *
 * Karta, która jeszcze nie zaraportowała, jest `pending` — dzięki temu nagłówek
 * porażki nie mignie w trakcie ładowania.
 */
export function resolveConfirmationHeroTone(
  orderIds: readonly string[],
  outcomes: Readonly<Record<string, ConfirmationOrderOutcome>>
): ConfirmationHeroTone {
  const rendered = orderIds.length;
  const failed = orderIds.filter(id => outcomes[id] === 'failed').length;

  if (rendered > 0 && failed === rendered) return 'failure';
  if (failed > 0) return 'partial';
  return 'success';
}
