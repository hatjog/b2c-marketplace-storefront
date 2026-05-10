/**
 * payment-status-adapter.ts — Single source of truth for payment/order
 * lifecycle state ID → UI label → recovery CTA mapping.
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * RULES (enforced by validate_lifecycle_and_config_drift_contracts.py):
 *   - State IDs come EXCLUSIVELY from the shared lifecycle state machine:
 *     specs/releases/v1.7.0/lifecycle/shared-lifecycle-state-machine.lifecycle.json
 *   - NO local enum aliases (processing, held, verifying, done, etc.)
 *   - NO optimistic-paid: never claim `paid` without backend evidence.
 *   - Exactly ONE primary recovery CTA per status (AC3 / FR8).
 *   - Secondary support contact may be a quiet text link only.
 *
 * ARCH-007: Customer-facing storefront only.
 * Pure computation — no JSX, no UI. Safe for server + client components.
 */

/**
 * Payment domain state IDs — verbatim from the shared lifecycle state machine.
 * Must not be renamed or augmented with local aliases.
 */
export type PaymentStatusId =
  | 'paid'
  | 'pending_psp_confirmation'
  | 'failed'
  | 'support_required'
  | 'expired';

/**
 * Canonical set of payment status IDs surfaced on the payment-status route.
 * Any unknown backend status should map to `pending_psp_confirmation` (safe default).
 */
export const PAYMENT_STATUS_IDS: readonly PaymentStatusId[] = [
  'paid',
  'pending_psp_confirmation',
  'failed',
  'support_required',
  'expired',
] as const;

/**
 * Recovery action variant — determines which CTA type to render.
 * Exactly one primary path per status (FR8).
 */
export type RecoveryActionKind =
  | 'continue'       // paid → handoff to confirmation (Story 2.5)
  | 'refresh'        // pending_psp_confirmation → refresh status
  | 'retry'          // failed → retry payment (mutation, explicit user action)
  | 'contact_support' // support_required → contact support
  | 'abandon';       // expired → abandon checkout / start over

/**
 * UI descriptor for one payment status — maps lifecycle state ID to localized
 * i18n key paths and primary recovery action.
 *
 * i18n keys are paths into the `payment_status.*` namespace (messages/*.json).
 * Callers receive the translated values; this adapter holds only the key paths.
 */
export interface PaymentStatusDescriptor {
  /** Shared lifecycle state machine state_id — never rename. */
  statusId: PaymentStatusId;
  /** next-intl key for the human-readable status label. */
  labelKey: string;
  /** next-intl key for the body/explanation copy. */
  bodyKey: string;
  /** Primary recovery action — exactly one per status. */
  primaryAction: {
    kind: RecoveryActionKind;
    /** next-intl key for the primary CTA button label. */
    ctaLabelKey: string;
  };
  /** Optional secondary text link — contact support / help (never a competing primary). */
  secondaryActionKey?: string;
}

/**
 * Canonical mapping: payment lifecycle state ID → UI descriptor.
 * This is the ONLY place in the storefront where status → UI label derivation lives.
 * All payment-status surface renderers MUST use this map.
 *
 * Recovery path mapping per FR8:
 *   paid                   → "Continue" (handoff to confirmation surface — Story 2.5)
 *   pending_psp_confirmation → "Refresh status now" (status read, NOT a payment mutation)
 *   failed                 → "Retry payment" (explicit mutation with fresh idempotency key)
 *   support_required       → "Contact support" (safe handoff, no PII in URL)
 *   expired                → "Abandon checkout" (previous attempt is closed)
 */
export const PAYMENT_STATUS_MAP: Record<PaymentStatusId, PaymentStatusDescriptor> = {
  paid: {
    statusId: 'paid',
    labelKey: 'payment_status.paid.label',
    bodyKey: 'payment_status.paid.body',
    primaryAction: {
      kind: 'continue',
      ctaLabelKey: 'payment_status.paid.cta',
    },
  },
  pending_psp_confirmation: {
    statusId: 'pending_psp_confirmation',
    labelKey: 'payment_status.pending_psp_confirmation.label',
    bodyKey: 'payment_status.pending_psp_confirmation.body',
    primaryAction: {
      kind: 'refresh',
      ctaLabelKey: 'payment_status.pending_psp_confirmation.cta',
    },
    secondaryActionKey: 'payment_status.pending_psp_confirmation.secondary_cta',
  },
  failed: {
    statusId: 'failed',
    labelKey: 'payment_status.failed.label',
    bodyKey: 'payment_status.failed.body',
    primaryAction: {
      kind: 'retry',
      ctaLabelKey: 'payment_status.failed.cta',
    },
    secondaryActionKey: 'payment_status.failed.secondary_cta',
  },
  support_required: {
    statusId: 'support_required',
    labelKey: 'payment_status.support_required.label',
    bodyKey: 'payment_status.support_required.body',
    primaryAction: {
      kind: 'contact_support',
      ctaLabelKey: 'payment_status.support_required.cta',
    },
  },
  expired: {
    statusId: 'expired',
    labelKey: 'payment_status.expired.label',
    bodyKey: 'payment_status.expired.body',
    primaryAction: {
      kind: 'abandon',
      ctaLabelKey: 'payment_status.expired.cta',
    },
    secondaryActionKey: 'payment_status.expired.secondary_cta',
  },
};

/**
 * Safely resolves a backend payment status string to a canonical PaymentStatusId.
 *
 * Unknown/null/undefined status maps to `pending_psp_confirmation` — the safe
 * ambiguous-state default. This prevents optimistic-paid (anti-pattern banned
 * in Story 2.4 spec) and avoids empty/null rendering on the status surface.
 *
 * Idempotency note: this is a pure read. Never call a payment mutation here.
 */
export function resolvePaymentStatusId(
  rawStatus: string | null | undefined,
): PaymentStatusId {
  if (rawStatus && (PAYMENT_STATUS_IDS as readonly string[]).includes(rawStatus)) {
    return rawStatus as PaymentStatusId;
  }
  // Unknown → safe pending default (never optimistically claim paid).
  return 'pending_psp_confirmation';
}

/**
 * Returns the UI descriptor for a given payment status ID.
 * Always returns a valid descriptor (fallback: pending_psp_confirmation).
 */
export function getPaymentStatusDescriptor(
  statusId: PaymentStatusId,
): PaymentStatusDescriptor {
  return PAYMENT_STATUS_MAP[statusId] ?? PAYMENT_STATUS_MAP['pending_psp_confirmation'];
}
