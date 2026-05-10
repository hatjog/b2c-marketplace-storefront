/**
 * Confirmation State Helper — UX-CMP-4 (Story 2.5)
 *
 * Determines the UI state of the post-purchase confirmation page
 * based on order payment_status, entitlement availability, and
 * optional delivery state metadata.
 *
 * --- State mapping table (UX-CMP-4 contract) ---
 *
 * Input combination                                           → ConfirmationHandoffState
 * ──────────────────────────────────────────────────────────────────────────────────────
 * payment_status = 'not_paid' | 'awaiting' | PSP-pending     → 'payment_pending'
 * payment_status = 'canceled' | 'expired'                    → 'payment_failed_retry'
 * payment_status = 'paid' + entitlement ISSUED/ACTIVE        → 'paid_delivered'
 * payment_status = 'paid' + no entitlement (evidence absent) → 'paid_delivery_pending'
 * payment_status = 'paid' + delivery_state='failed'          → 'support_required'
 *   OR payment_status = 'support_required' (proxy-mapped)
 *   OR metadata.requires_support = true
 *
 * HONESTY RULE (AC2): "no entitlement" ≠ failure.
 *   → paid + missing entitlement = 'paid_delivery_pending', NOT 'support_required'.
 *   → 'support_required' requires positive evidence: delivery_state='failed' OR
 *     requires_support=true OR payment_status='support_required' from proxy.
 *
 * --- Legacy 3-state export (backward compat) ---
 * getConfirmationState() still exported for call-sites that have not migrated.
 * Internally delegates to getConfirmationHandoffState().
 *
 * --- Lifecycle vocabulary ---
 * payment_status values arriving from the API proxy (/api/v1/orders/[id]/route.ts
 * Story 2.4 F3 fix) use the GP shared lifecycle vocabulary:
 *   paid | pending_psp_confirmation | failed | support_required | expired
 * Older raw Medusa values (not_paid, awaiting, canceled) are kept as fallbacks
 * to remain robust against proxy bypass or direct test injection.
 *
 * Source: _bmad-output/releases/v1.7.0/planning-artifacts/ux-design-specification.md#UX-CMP-4
 * ARCH-004 / ARCH-007 / Shared Enum Rule (Story 2.5 SSOT)
 */

// ─── Legacy type (kept for backward compat) ───────────────────────────────────

export type ConfirmationState = 'success' | 'pending' | 'error';

// ─── UX-CMP-4 five-state contract ─────────────────────────────────────────────

/**
 * Five-state confirmation handoff — UX-CMP-4 normative contract.
 *
 * paid_delivered        — payment confirmed + entitlement available and usable
 * paid_delivery_pending — payment confirmed but entitlement/delivery evidence absent
 * payment_pending       — PSP confirmation still in flight (not yet paid)
 * payment_failed_retry  — payment explicitly failed/expired, user can retry
 * support_required      — positive evidence of delivery failure; operator/recovery path
 */
export type ConfirmationHandoffState =
  | 'paid_delivered'
  | 'paid_delivery_pending'
  | 'payment_pending'
  | 'payment_failed_retry'
  | 'support_required';

/**
 * Input data for state derivation.
 * Mirrors the shapes returned by /api/v1/orders/[id] and /api/v1/entitlements.
 */
export interface ConfirmationStateInput {
  /** GP shared lifecycle status from proxy (or raw Medusa value as fallback). */
  paymentStatus: string | null | undefined;
  /** Entitlements array from /api/v1/entitlements?order_id={id}. */
  entitlements?: Array<{ status: string; voucher_code: string | null; claim_url: string | null }>;
  /**
   * Optional order metadata for positive delivery-failure evidence.
   * Not in current proxy contract — flagged as additive follow-up.
   * When provided, `delivery_state === 'failed'` or `requires_support === true`
   * escalates paid state to 'support_required'.
   *
   * NOTE: The /api/v1/orders/[id] proxy (Story 2.4 F4 fix) drops `metadata`
   * from the upstream Medusa fields set to prevent internal flags reaching
   * the browser. These fields are therefore NOT currently available in
   * production; the metadata path is reserved for when an explicit
   * delivery-state signal is surfaced via a separate evidence endpoint
   * (Epic 7/8 contract). Implementation accepts the shape to keep the
   * state machine deterministic if metadata becomes available.
   */
  metadata?: {
    delivery_state?: string;
    requires_support?: boolean;
    buyer_is_recipient?: boolean;
  };
}

/** Set of payment status values that mean "paid" (lifecycle + raw Medusa fallback). */
const PAID_STATUSES = new Set(['paid', 'captured', 'partially_captured']);

/** Set of payment status values that mean "pending PSP confirmation". */
const PENDING_PSP_STATUSES = new Set([
  'pending_psp_confirmation',
  'not_paid',
  'awaiting',
  'authorized',
  'partially_authorized',
  'requires_action',
]);

/** Set of payment status values that mean "payment failed / expired". */
const FAILED_STATUSES = new Set(['payment_failed_retry', 'failed', 'canceled', 'expired']);

/**
 * Derives the UX-CMP-4 five-state ConfirmationHandoffState from order + entitlement inputs.
 *
 * This is the single deterministic derivation rule — no scattered conditionals
 * in view components.
 *
 * HONESTY RULE: never escalate to 'support_required' from absence alone.
 * Absence of entitlement → 'paid_delivery_pending'. Support required needs
 * positive evidence (metadata OR proxy-mapped 'support_required' status).
 */
export function getConfirmationHandoffState(
  input: ConfirmationStateInput,
): ConfirmationHandoffState {
  const { paymentStatus, entitlements = [], metadata } = input;
  const ps = paymentStatus ?? '';

  // 1. Payment-pending PSP confirmation
  if (PENDING_PSP_STATUSES.has(ps)) {
    return 'payment_pending';
  }

  // 2. Payment failed / expired — explicit cancelation/failure (retry path)
  if (FAILED_STATUSES.has(ps)) {
    return 'payment_failed_retry';
  }

  // 3. Proxy-mapped support_required (from refund/refund-partial/support_required)
  if (ps === 'support_required') {
    return 'support_required';
  }

  // 4. Payment confirmed (paid)
  if (PAID_STATUSES.has(ps)) {
    // 4a. Positive delivery-failure evidence → support_required
    if (
      metadata?.delivery_state === 'failed' ||
      metadata?.requires_support === true
    ) {
      return 'support_required';
    }

    // 4b. Entitlement available and usable → paid_delivered
    const usableEntitlement = entitlements.find(
      (e) => e.status === 'ISSUED' || e.status === 'ACTIVE'
    );
    if (usableEntitlement) {
      return 'paid_delivered';
    }

    // 4c. No entitlement yet — paid but delivery evidence absent
    // HONESTY: this is NOT failure; delivery is in progress
    return 'paid_delivery_pending';
  }

  // 5. Unknown status — safe default: pending (anti-optimistic-paid)
  return 'payment_pending';
}

// ─── Legacy 3-state bridge (backward compat) ──────────────────────────────────

/**
 * Legacy adapter — maps ConfirmationHandoffState to the old 3-state enum.
 *
 * Used by call-sites that have not yet migrated to getConfirmationHandoffState().
 * Kept to avoid breaking changes until all callers migrate.
 *
 * Mapping:
 *   paid_delivered        → 'success'
 *   paid_delivery_pending → 'success'  (was "generic success" in v120-3.6)
 *   payment_pending       → 'pending'
 *   payment_failed_retry  → 'error'
 *   support_required      → 'error'    (conservative; was conflated in old code)
 */
export function getConfirmationState(paymentStatus: string | undefined): ConfirmationState {
  const handoffState = getConfirmationHandoffState({ paymentStatus });
  switch (handoffState) {
    case 'paid_delivered':
    case 'paid_delivery_pending':
      return 'success';
    case 'payment_pending':
      return 'pending';
    case 'payment_failed_retry':
    case 'support_required':
      return 'error';
  }
}
