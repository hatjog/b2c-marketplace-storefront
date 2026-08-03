/**
 * Story v170-6-2: Storefront runtime state structured log emission.
 *
 * Emits a structured server log line via the existing `logger` utility
 * whenever a storefront route state is evaluated on a critical path.
 *
 * Log shape (event_type: "storefront_runtime_state.evaluated"):
 *   {
 *     event_type: "storefront_runtime_state.evaluated",
 *     source: "storefront",
 *     context: {
 *       route: "<route-id>",
 *       state: "<one of 10 canonical tokens>",
 *       state_detail: "<detail-token or null>",
 *       market_id: "<non-pii market id>",
 *       freshness: "current|stale|missing",
 *       action_blocked: true|false,
 *       surface: "<route-segment>"
 *     }
 *   }
 *
 * PII policy: NO PII in payload. market_id is a non-personal market identifier
 * (e.g., "bonbeauty-pl"). No user IDs, email, order IDs, voucher codes.
 *
 * Mirrors the shape of `logWithdrawalStateEvaluated` from Story 2.9 so
 * cross-signal Epic 8 / Epic 9 validators can reuse field patterns.
 *
 * @module lib/helpers/storefront-state-logger
 * @see Story 6.2 AC3; Story 2.9 (withdrawal-state-logger pattern)
 */

import type { StorefrontStateResult } from '@/lib/helpers/storefront-state';
import { logger } from '@/lib/logger';

/**
 * Allowed surface tokens for the `storefront_runtime_state.evaluated` log.
 * Kept in sync with the story Dev Notes AC3 signal contract.
 */
export const STOREFRONT_SURFACES = [
  'home',
  'category',
  'listing',
  'pdp',
  'cart',
  'checkout',
  'payment-status',
  'confirmation',
  'auth-login',
  'auth-register',
  'auth-forgot-password',
  'user-account',
  'user-orders',
  'user-vouchers',
  'voucher-detail',
  'voucher-consent',
  'voucher-recovery',
  'voucher-recipient',
  'w2-01-dashboard',
  'w2-03-orders',
  'legal-regulamin',
  'legal-polityka-prywatnosci',
  'legal-zasady',
  'legal-pomoc',
  'unknown'
] as const;

export type StorefrontSurface = (typeof STOREFRONT_SURFACES)[number];

/**
 * Emit a structured log line for storefront runtime state evaluation.
 *
 * Call this from Server Components after resolving `resolveStorefrontState()`.
 * Fire-and-forget; must not throw.
 *
 * @param result - The StorefrontStateResult from `resolveStorefrontState()`.
 * @param route - The canonical route id (matches `data-route` on the DOM signal).
 * @param surface - The surface identifier for this evaluation context.
 */
export function logStorefrontStateEvaluated(
  result: StorefrontStateResult,
  route: string,
  surface: StorefrontSurface = 'unknown'
): void {
  try {
    const payload = {
      source: 'storefront' as const,
      context: {
        route,
        state: result.state,
        state_detail: result.state_detail,
        market_id: result.market_id,
        freshness: result.freshness,
        action_blocked: result.action_blocked,
        surface
      }
    };
    if (result.action_blocked) {
      logger.error('storefront_runtime_state.evaluated', payload);
    } else {
      logger.warn('storefront_runtime_state.evaluated', payload);
    }
  } catch {
    // Swallow — log emission must never break the render path.
  }
}
