/**
 * buildAuditPayload — thin payload constructor for the voucher PII consent audit
 * chain. Synthesis of DRY-purist vs YAGNI-pragmatist review per Method #19
 * (Code Review Gauntlet) in STORY-2-1.
 *
 * Consumers: `grantConsent`, `withdrawConsent`, `pauseRecipient` Server Actions.
 *
 * Produced shape is the JSONB payload eventually written to
 * `voucher_pii_consent_audit.payload` by the Story 2-2 backend pipeline. Until
 * that pipeline lands, the Server Action posts the payload to a STUB endpoint
 * documented in `voucher-consent.ts`.
 *
 * Privacy boundary (privacy-boundaries.md):
 *   - PII (email / phone / message) NEVER lands in the audit payload.
 *   - Audit payload carries only ids, action verbs, locale, and provenance.
 */

export type ConsentAuditAction = 'grant' | 'withdraw' | 'pause';

export interface BuildAuditPayloadInput {
  action: ConsentAuditAction;
  /** Stable opaque consent token from the deep-link URL. */
  token: string;
  /** ISO 639-1 language code as resolved by next-intl. */
  locale: string;
  /** Audit row id of the original grant — required only for withdrawal. */
  compensatesAuditId?: string;
  /** Optional pause-state machine label for SC-3 ambivalence telemetry. */
  pauseState?: 'considering' | 'paused' | 'timeout' | 'withdrawn';
  /** Provenance hint — JS path or no-JS Server Action form post. */
  surface: 'js' | 'no-js';
  /** Wall-clock timestamp (ms epoch). Caller passes Date.now() so tests can mock. */
  occurredAt: number;
}

export interface ConsentAuditPayload {
  action: ConsentAuditAction;
  token: string;
  locale: string;
  surface: 'js' | 'no-js';
  occurred_at: string;
  compensates_audit_id?: string;
  pause_state?: BuildAuditPayloadInput['pauseState'];
  schema_version: 1;
}

export function buildAuditPayload(input: BuildAuditPayloadInput): ConsentAuditPayload {
  if (input.action === 'withdraw' && !input.compensatesAuditId) {
    // Hard invariant: withdrawal MUST reference original grant for audit chain.
    throw new Error(
      'buildAuditPayload: withdrawal action requires compensatesAuditId (D-66 contract).'
    );
  }
  if (input.action === 'pause' && !input.pauseState) {
    throw new Error(
      'buildAuditPayload: pause action requires pauseState (UX-DR5 5-state machine).'
    );
  }
  const payload: ConsentAuditPayload = {
    action: input.action,
    token: input.token,
    locale: input.locale,
    surface: input.surface,
    occurred_at: new Date(input.occurredAt).toISOString(),
    schema_version: 1
  };
  if (input.compensatesAuditId) {
    payload.compensates_audit_id = input.compensatesAuditId;
  }
  if (input.pauseState) {
    payload.pause_state = input.pauseState;
  }
  return payload;
}
