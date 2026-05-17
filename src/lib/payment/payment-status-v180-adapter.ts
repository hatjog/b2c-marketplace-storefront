/**
 * payment-status-v180-adapter.ts — v1.8.0 payment lifecycle state mapping.
 *
 * v1.8.0 Story 1.5: Payment Status Surface 6 States.
 *
 * Extends the v1.7.0 5-state vocab to 6 states, adding split between
 * retryable and non-retryable failure paths.
 *
 * Backward-compat mapping (Story 1.3 backend returns 5-state vocab):
 *   pending_psp_confirmation → pending_psp
 *   failed (no failure_code)  → failed_retryable
 *   failed (with failure_code) → determined by caller context
 *
 * ARCH-007: Customer-facing storefront only.
 * Pure computation — no JSX, no UI. Safe for server + client components.
 */

/**
 * v1.8.0 6-state payment lifecycle vocabulary.
 * Superset of v1.7.0 PaymentStatusId — old states removed, new introduced.
 */
export type PaymentStatusV180 =
  | 'paid'
  | 'pending_psp'
  | 'failed_retryable'
  | 'failed_nonretryable'
  | 'expired'
  | 'support_required';

export const PAYMENT_STATUS_V180_IDS: readonly PaymentStatusV180[] = [
  'paid',
  'pending_psp',
  'failed_retryable',
  'failed_nonretryable',
  'expired',
  'support_required',
] as const;

/**
 * Backend response shape — Story 1.3 route returns 5-state or 6-state vocab.
 * failure_code and ticket_id are v1.8.0 additions; may be absent on older responses.
 */
export type BackendPaymentStatusResponse = {
  status: string;
  last_checked_at: string;
  recommended_action_key: string;
  request_id?: string | null;
  failure_code?: string | null;
  ticket_id?: string | null;
};

/**
 * Maps raw backend status string to canonical PaymentStatusV180.
 *
 * Backward-compat rules:
 *   - pending_psp_confirmation → pending_psp (v1.7.0 compat)
 *   - failed → failed_retryable (default; no failure_code = retryable)
 *   - New 6-state vocab → pass-through
 *   - Unknown/null/undefined → pending_psp (safe ambiguous default)
 */
export function resolvePaymentStatusV180(
  rawStatus: string | null | undefined,
): PaymentStatusV180 {
  if (!rawStatus) return 'pending_psp';

  // Pass-through for already-valid v1.8.0 statuses
  if ((PAYMENT_STATUS_V180_IDS as readonly string[]).includes(rawStatus)) {
    return rawStatus as PaymentStatusV180;
  }

  // Backward-compat mapping from v1.7.0 vocab
  switch (rawStatus) {
    case 'pending_psp_confirmation':
      return 'pending_psp';
    case 'failed':
      // Without failure_code context, default to retryable
      return 'failed_retryable';
    default:
      // Unknown status → safe pending default (never optimistically claim paid)
      return 'pending_psp';
  }
}

/**
 * Resolves status from full backend response, using failure_code to
 * differentiate retryable vs non-retryable failures.
 */
export function resolveStatusFromResponse(
  response: Pick<BackendPaymentStatusResponse, 'status' | 'failure_code'>,
): PaymentStatusV180 {
  const base = resolvePaymentStatusV180(response.status);

  // If backend returned legacy 'failed' and there IS a failure_code, treat as non-retryable
  if (
    (response.status === 'failed' || base === 'failed_retryable') &&
    response.failure_code
  ) {
    return 'failed_nonretryable';
  }

  return base;
}

/** Terminal states — polling stops when reached. */
export const TERMINAL_STATUSES_V180: ReadonlySet<PaymentStatusV180> = new Set([
  'paid',
  'failed_retryable',
  'failed_nonretryable',
  'support_required',
  'expired',
]);
