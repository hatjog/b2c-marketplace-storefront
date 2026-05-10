/**
 * Story v170-2-9: FR64 withdrawal state structured log emission.
 *
 * Emits a structured server log line via the existing `logger` utility
 * whenever a withdrawal state is evaluated on a release-critical path.
 *
 * Log shape (event_type: "voucher_withdrawal_state.evaluated"):
 *   {
 *     event_type: "voucher_withdrawal_state.evaluated",
 *     source: "storefront",
 *     context: {
 *       state: "<fr64-state-token>",
 *       market_id: "<non-pii market id>",
 *       freshness: "current|stale|missing",
 *       action_blocked: true|false,
 *       surface: "<route-segment>"
 *     }
 *   }
 *
 * PII policy: NO PII in payload. market_id is a non-personal market identifier
 * (e.g., "bonbeauty-pl"). No user IDs, email, voucher codes, order IDs.
 *
 * Epic 7 integration: this log is the structured evidence line that Epic 7
 * validators can consume to assert "no silent fallback to default consent state".
 *
 * @module lib/helpers/withdrawal-state-logger
 * @see FR64; Story 2.9 AC3; Epic 7 Story 7.x
 */

import type { WithdrawalStateResult } from '@/types/voucher';
import { logger } from '@/lib/logger';

export type WithdrawalSurface =
  | 'checkout'
  | 'confirmation-handoff'
  | 'voucher-recovery'
  | 'voucher-card'
  | 'legal-help'
  | 'unknown';

/**
 * Emit a structured log line for FR64 withdrawal state evaluation.
 *
 * Call this from Server Components on release-critical paths after resolving
 * `getWithdrawalState()`. The log is fire-and-forget and must not throw.
 *
 * @param result - The `WithdrawalStateResult` from `getWithdrawalState()`.
 * @param surface - The route/surface identifier for this evaluation context.
 */
export function logWithdrawalStateEvaluated(
  result: WithdrawalStateResult,
  surface: WithdrawalSurface = 'unknown'
): void {
  try {
    const level = result.action_blocked ? 'warn' : 'warn';
    logger[level]('voucher_withdrawal_state.evaluated', {
      source: 'storefront',
      context: {
        state: result.state,
        market_id: result.market_id,
        freshness: result.freshness,
        action_blocked: result.action_blocked,
        surface,
      },
    });
  } catch {
    // Swallow — log emission must never break the render path.
  }
}
