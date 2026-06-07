/**
 * Pure mapping helpers for the `GET /api/v1/orders/[id]` proxy.
 *
 * Extracted from `route.ts` because Next.js App Router route files may only
 * export route handlers (`GET`/`POST`/...) and a small set of reserved config
 * symbols — exporting arbitrary helpers trips the generated route type check
 * (`OmitWithTag ... does not satisfy '{ [x: string]: never; }'`). Keeping the
 * mappers here lets both the route and unit tests import them without polluting
 * the route module surface.
 */

export function isGuestCheckout(customerId: string | null | undefined): boolean {
  return !customerId;
}

/**
 * Map Medusa's `OrderPaymentStatus` enum to a GP shared lifecycle state id.
 *
 * Conservative mapping — favours pending over paid. Refunds map to
 * `support_required` because Story 2.4 does not own the refund UX
 * (Story 2.5 / 2.6 surfaces own that copy); routing customers via support
 * keeps the AC3 single-recovery-path discipline auditable.
 *
 * R3 review fix: `requires_action` means the customer must complete SCA /
 * 3DS — it is a *retryable customer-actionable* state, not a *wait* state.
 * Mapping it to `pending_psp_confirmation` traps the customer in a refresh
 * loop; mapping it to `failed` surfaces the "Retry payment" CTA which is
 * the only correct recovery affordance.
 *
 * Anything unknown → `pending_psp_confirmation` (anti-optimistic-paid).
 */
export function mapMedusaPaymentStatusToLifecycle(raw: string | null | undefined): string {
  switch (raw) {
    case 'captured':
    case 'partially_captured':
      return 'paid';
    case 'not_paid':
    case 'awaiting':
    case 'authorized':
    case 'partially_authorized':
      return 'pending_psp_confirmation';
    case 'requires_action':
      // R3 fix: SCA / 3DS — retry is the only recovery; never wait.
      return 'failed';
    case 'canceled':
      return 'expired';
    case 'refunded':
    case 'partially_refunded':
      return 'support_required';
    default:
      return 'pending_psp_confirmation';
  }
}

/**
 * Map Medusa's order-level `status` to a GP lifecycle id where it can
 * advance beyond what `payment_status` declares.
 *
 * R4 review fix: Medusa's `payment_status` does NOT include `expired`
 * (only `canceled`). The `expired` lifecycle id is therefore unreachable
 * via `payment_status` alone. The order-level `status` (which can be
 * `archived` / `canceled` after a checkout-session TTL elapses) is the
 * authoritative source for that state.
 *
 * Returns `null` when the order-level status does not override the
 * payment-status mapping.
 */
export function mapMedusaOrderStatusToLifecycle(raw: string | null | undefined): string | null {
  switch (raw) {
    case 'archived':
    case 'canceled':
      return 'expired';
    default:
      return null;
  }
}
