'use server';

/**
 * v1.15.0 Story 3.7 (AC1, AC2) — SERWEROWE rozwinięcie identyfikatora zakupu
 * w kolekcję zamówień dla trasy `/[locale]/order/[id]/confirmed`.
 *
 * Decyzja jest w module CZYSTYM (`@/lib/confirmation/confirmation-purchase`);
 * tutaj jest wyłącznie dostęp do danych. Rozdział jest celowy: kardynalność
 * powierzchni ma być mierzalna wykonaniem bez stawiania backendu.
 */

import {
  decideConfirmationPurchase,
  type ConfirmationPurchase
} from '@/lib/confirmation/confirmation-purchase';
import { classifyPaymentReturnIdentifier } from '@/lib/checkout/payment-return-identifier';

import { getCompletedPurchaseForCart } from './cart';

export async function resolveConfirmationPurchase(
  rawIdentifier: unknown
): Promise<ConfirmationPurchase> {
  const identifier = classifyPaymentReturnIdentifier(rawIdentifier);

  if (identifier.kind !== 'cart') {
    return decideConfirmationPurchase({ identifier, bridge: null });
  }

  let bridge = null as Awaited<ReturnType<typeof getCompletedPurchaseForCart>> | null;
  try {
    bridge = await getCompletedPurchaseForCart(identifier.value, { attempts: 2 });
  } catch (error) {
    // Odmowa musi być widoczna (NFR-2/AD-19) — nie połykamy jej po cichu i nie
    // zamieniamy w pustą kolekcję. `bridge` zostaje `null`, a `null` znaczy
    // teraz `read_failed`, nie `purchase_not_found` (review-fix HIGH-3).
    console.warn(`[confirmation] bridge read failed cart=${identifier.value}`, error);
  }

  return decideConfirmationPurchase({ identifier, bridge });
}
