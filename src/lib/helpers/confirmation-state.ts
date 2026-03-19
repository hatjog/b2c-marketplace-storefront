/**
 * Confirmation State Helper — Story v120-3.6
 *
 * Determines the UI state of the post-purchase confirmation page
 * based on the order's payment_status field.
 */

export type ConfirmationState = 'success' | 'pending' | 'error';

/**
 * Maps order payment_status → ConfirmationState.
 *
 * canceled          → 'error'
 * not_paid/awaiting → 'pending'
 * all others        → 'success' (safe default)
 */
export function getConfirmationState(paymentStatus: string | undefined): ConfirmationState {
  if (paymentStatus === 'canceled') return 'error';
  if (paymentStatus === 'not_paid' || paymentStatus === 'awaiting') return 'pending';
  return 'success';
}
