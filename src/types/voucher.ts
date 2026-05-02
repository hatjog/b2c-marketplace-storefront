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
