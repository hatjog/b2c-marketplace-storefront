/**
 * Story 3.3 AC2 — runda fix 2 (ADR-242 §Decyzja p.5): linia voucherowa w koszyku
 * ma quantity=1. Backend odrzuca inną krotność (400, reason
 * `voucher_line_quantity_unsupported`); storefront nie prowadzi kupującej do
 * tej odmowy — ponowne dodanie tego samego vouchera nie zwiększa ilości, a
 * zmiana ilości linii voucherowej jest zablokowana.
 *
 * Kryterium „linia voucherowa" jest lustrem kryterium wystawcy backendu
 * (`lib/payment/voucher-line-quantity.ts`): marker entitlement w metadanych
 * linii ALBO `product.metadata.gp.entitlement_profile`.
 */
export const VOUCHER_LINE_QUANTITY_REASON = 'voucher_line_quantity_unsupported' as const;
export const VOUCHER_LINE_MAX_QUANTITY = 1;

const VOUCHER_INTENT_KEYS = [
  'entitlement_profile',
  'entitlement_profile_id',
  'profile_id',
  'entitlement_type',
  'entitlement_policy',
  'recipients'
] as const;

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function isVoucherCartLine(lineMetadata: unknown, productMetadata?: unknown): boolean {
  const line = readObject(lineMetadata);
  if (line && VOUCHER_INTENT_KEYS.some(k => line[k] != null)) return true;
  const gp = readObject(readObject(productMetadata)?.gp);
  return gp?.entitlement_profile != null;
}

export type AddToCartOutcome =
  | { status: 'added' }
  | { status: 'rejected'; reason: typeof VOUCHER_LINE_QUANTITY_REASON };

/**
 * Decyzja przed wywołaniem API: voucher, którego wynikowa ilość w koszyku
 * przekroczyłaby 1, jest odrzucany NAZWANYM wynikiem (komunikat w UI), a nie
 * cicho obcinany ani wysyłany do backendu po 400.
 */
export function decideVoucherAddToCart(input: {
  isVoucher: boolean;
  currentQuantity: number;
  requestedQuantity: number;
}): AddToCartOutcome {
  if (!input.isVoucher) return { status: 'added' };
  return input.currentQuantity + input.requestedQuantity > VOUCHER_LINE_MAX_QUANTITY
    ? { status: 'rejected', reason: VOUCHER_LINE_QUANTITY_REASON }
    : { status: 'added' };
}
