/**
 * Story v160-6-3: Voucher audit trail event types — recipient-side timeline
 * primitives (Server Component data layer + UI molecule consumer).
 *
 * Privacy boundary AR45: events are PII-free by construction. The `metadata`
 * field is intentionally typed as `Record<string, never>` — even if the
 * backend payload returns metadata fields, the projection in
 * `getVoucherEvents()` strips them before render. This keeps the timeline
 * audit trail visible to the recipient WITHOUT leaking buyer-side identity.
 */

// ---------------------------------------------------------------------------
// Story v170-2-9: Consumer-purchase withdrawal lifecycle (FR64)
//
// IMPORTANT: This enum represents **consumer-purchase withdrawal** under
// Ustawa o prawach konsumenta (Polish Consumer Rights Act, 14-day window).
// It is DISTINCT from recipient-PII consent withdrawal (RODO Art. 7/17),
// which uses `VoucherAuditEventType` "withdrawn" and the existing
// `consent` / `consent_pause` / `withdrawn_status` i18n namespaces.
//
// These two lifecycles must NOT be conflated in copy, types or DOM signals.
// ---------------------------------------------------------------------------

/**
 * FR64 consumer-purchase withdrawal state enum.
 *
 * Exact kebab-case tokens that appear verbatim in:
 *   - `data-state` DOM attributes on `voucher-withdrawal-state-signal` landmark
 *   - Storefront structured log payloads (`voucher_withdrawal_state.evaluated`)
 *   - i18n key suffixes under `voucher_withdrawal.state_<token_as_snake_case>.*`
 */
export const WITHDRAWAL_LIFECYCLE_STATES = [
  "withdrawal-eligible-before-service-execution",
  "consent-to-execute-captured",
  "withdrawal-blocked-after-execution",
  "refunded",
  "support-review",
] as const;

export type WithdrawalLifecycleState = typeof WITHDRAWAL_LIFECYCLE_STATES[number];

/**
 * Freshness classification for the FR64 state signal.
 * - "current"  — state derived from fresh order/voucher data within the freshness window
 * - "stale"    — state data is older than the freshness window for the active flow
 * - "missing"  — no state could be derived (no order data, no voucher record, etc.)
 */
export type WithdrawalFreshness = "current" | "stale" | "missing";

/**
 * Structured payload emitted by `getWithdrawalState()` for use in both
 * the DOM signal landmark and the structured server log.
 */
export interface WithdrawalStateResult {
  /** FR64 canonical state token. Always `"support-review"` when freshness is not "current". */
  state: WithdrawalLifecycleState;
  /** Market identifier from the active session (no PII). */
  market_id: string;
  /** Freshness classification for the active flow context. */
  freshness: WithdrawalFreshness;
  /** Whether a release-critical CTA was blocked due to non-deterministic state. */
  action_blocked: boolean;
}

// ---------------------------------------------------------------------------
// Original audit trail types (Story v160-6-3) — recipient-PII context
// ---------------------------------------------------------------------------

export type VoucherAuditEventType =
  | "created"
  | "sent"
  | "opened"
  | "claimed"
  | "withdrawn";

export interface VoucherAuditEvent {
  /** Stable event id (UUID or backend primary key). */
  id: string;
  /** Event-type discriminator (5 known types per AR45 allowlist). */
  event_type: VoucherAuditEventType;
  /** ISO 8601 timestamp of event occurrence. */
  occurred_at: string;
  /** Always empty per AR45 — buyer-side metadata stripped server-side. */
  metadata?: Record<string, never>;
}
