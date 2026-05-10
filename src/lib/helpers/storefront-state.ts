/**
 * Story v170-6-2: Full-state storefront runtime coverage — state resolver.
 *
 * Provides a pure, data-shape-driven function that maps route data context to
 * one of the ten canonical storefront state tokens defined in the UX state
 * contract (ux-state-contract.v1.schema.json).
 *
 * Anti-silent-fallback policy (AC3 / UX-DR19):
 *   When state CANNOT be derived deterministically (missing market_id, stale/
 *   missing freshness, unknown provider config, or isolation failure) the
 *   function returns `unavailable` (or `access_denied` for authz failures)
 *   with `action_blocked = true`. The UI MUST NEVER silently downgrade
 *   these cases to `empty` or `loading` — that would mask config/access/
 *   isolation failures from Epic 8 / Epic 9 validators.
 *
 * @module lib/helpers/storefront-state
 * @see specs/contracts/governance/schemas/ux-state-contract.v1.schema.json
 * @see Story 6.2 AC1/AC3; UX-DR19
 */

import { getMarketId } from '@/lib/helpers/market-filter';

/** The ten canonical storefront state tokens — verbatim from the UX state contract. */
export const STOREFRONT_STATE_TOKENS = [
  'loading',
  'empty',
  'validation',
  'unavailable',
  'access_denied',
  'stale',
  'pending',
  'failed',
  'retry',
  'recovered'
] as const;

export type StorefrontStateToken = (typeof STOREFRONT_STATE_TOKENS)[number];

/** Detail tokens used in data-state-detail (UX-DR19). */
export const STOREFRONT_STATE_DETAIL_TOKENS = [
  // empty sub-modes
  'initial',
  'no-results',
  'permission-denied',
  'load-error',
  // loading sub-modes
  'routing-load',
  'submit-load',
  // other
  'provider-unavailable',
  'market-unknown',
  'psp-timeout',
  'freshness-stale',
  'freshness-missing'
] as const;

export type StorefrontStateDetailToken = (typeof STOREFRONT_STATE_DETAIL_TOKENS)[number];

export type StorefrontFreshness = 'current' | 'stale' | 'missing';

/**
 * Input shape for storefront state derivation.
 * All fields optional — callers provide only what their data shape exposes.
 */
export interface StorefrontStateInput {
  /** True while route data is still being fetched (routing-load). */
  is_loading?: boolean;
  /** True while a mutation is in-flight (submit-load — e.g. cart update, checkout submit). */
  is_submitting?: boolean;
  /** True only for a genuinely empty dataset (no items, no error). Never use for errors. */
  is_genuinely_empty?: boolean;
  /** Sub-mode detail for the empty state (UX-DR19). Defaults to 'no-results'. */
  empty_detail?: 'initial' | 'no-results' | 'permission-denied' | 'load-error';
  /** True when a form / server validation error is present. */
  has_validation_error?: boolean;
  /** True when an authz / isolation guard has blocked access. NEVER render as empty. */
  is_access_denied?: boolean;
  /** True when a provider / config / capability is unavailable. */
  is_unavailable?: boolean;
  /** True when data freshness window is exceeded (data is stale but present). */
  is_stale?: boolean;
  /** True when a payment / order / communication lifecycle is pending resolution. */
  is_pending?: boolean;
  /** True when a domain-level failure has occurred. */
  has_failed?: boolean;
  /** True when a retry is actively in-progress. */
  is_retrying?: boolean;
  /** True when the route has recovered from a previous failure. */
  is_recovered?: boolean;
  /**
   * Market id override. When omitted, `getMarketId()` is called.
   * Pass explicitly in tests to avoid environment dependency.
   * An empty/missing market_id forces `unavailable/market-unknown` (AC3).
   */
  market_id?: string;
  /**
   * Freshness classification from calling context.
   * `stale` or `missing` forces `unavailable` with action_blocked=true (AC3).
   */
  freshness?: StorefrontFreshness;
}

export interface StorefrontStateResult {
  state: StorefrontStateToken;
  state_detail: StorefrontStateDetailToken | null;
  market_id: string;
  freshness: StorefrontFreshness;
  action_blocked: boolean;
}

/**
 * Resolve one of the 10 canonical storefront state tokens from a data-shape input.
 *
 * Resolution priority (highest to lowest):
 *   1. Freshness guard — stale/missing → unavailable (anti-silent-fallback, AC3)
 *   2. Missing market_id → unavailable/market-unknown (AC3)
 *   3. access_denied → access_denied/permission-denied (NEVER empty)
 *   4. is_unavailable → unavailable/provider-unavailable
 *   5. has_failed → failed/load-error
 *   6. is_retrying → retry
 *   7. is_recovered → recovered
 *   8. is_pending → pending
 *   9. is_stale → stale/freshness-stale
 *   10. has_validation_error → validation
 *   11. is_submitting → loading/submit-load
 *   12. is_loading → loading/routing-load
 *   13. is_genuinely_empty → empty/<empty_detail>
 *   14. default → loading/routing-load (safe conservative)
 *
 * @param input - Data-shape context for this route evaluation.
 * @returns A StorefrontStateResult with state, state_detail, freshness, action_blocked.
 */
export function resolveStorefrontState(input: StorefrontStateInput = {}): StorefrontStateResult {
  const {
    is_loading,
    is_submitting,
    is_genuinely_empty,
    empty_detail = 'no-results',
    has_validation_error,
    is_access_denied,
    is_unavailable,
    is_stale,
    is_pending,
    has_failed,
    is_retrying,
    is_recovered,
    market_id: inputMarketId,
    freshness = 'current'
  } = input;

  const market_id = inputMarketId ?? getMarketId();
  const resolvedMarketId = market_id || 'unknown';

  const withMarket = (result: Omit<StorefrontStateResult, 'market_id'>): StorefrontStateResult => ({
    ...result,
    market_id: resolvedMarketId
  });

  // Guard 1: stale/missing freshness → unavailable (AC3 anti-silent-fallback)
  if (freshness === 'stale' || freshness === 'missing') {
    return withMarket({
      state: 'unavailable',
      state_detail: freshness === 'stale' ? 'freshness-stale' : 'freshness-missing',
      freshness,
      action_blocked: true
    });
  }

  // Guard 2: missing/empty market_id → unavailable/market-unknown (AC3)
  if (!market_id) {
    return withMarket({
      state: 'unavailable',
      state_detail: 'market-unknown',
      freshness: 'missing',
      action_blocked: true
    });
  }

  // Priority 3: authz/isolation failure → access_denied (NEVER empty, AC1)
  if (is_access_denied) {
    return withMarket({
      state: 'access_denied',
      state_detail: 'permission-denied',
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 4: provider/config unavailable
  if (is_unavailable) {
    return withMarket({
      state: 'unavailable',
      state_detail: 'provider-unavailable',
      freshness: 'current',
      action_blocked: true
    });
  }

  // Priority 5: domain failure
  if (has_failed) {
    return withMarket({
      state: 'failed',
      state_detail: 'load-error',
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 6: retry in-progress
  if (is_retrying) {
    return withMarket({
      state: 'retry',
      state_detail: null,
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 7: recovered from failure
  if (is_recovered) {
    return withMarket({
      state: 'recovered',
      state_detail: null,
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 8: payment/order/communication lifecycle pending
  if (is_pending) {
    return withMarket({
      state: 'pending',
      state_detail: null,
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 9: data is stale
  if (is_stale) {
    return withMarket({
      state: 'stale',
      state_detail: 'freshness-stale',
      freshness: 'stale',
      action_blocked: false
    });
  }

  // Priority 10: form/server validation error
  if (has_validation_error) {
    return withMarket({
      state: 'validation',
      state_detail: null,
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 11: submit-in-flight (UX-DR19 submit-load distinction)
  if (is_submitting) {
    return withMarket({
      state: 'loading',
      state_detail: 'submit-load',
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 12: route data loading (UX-DR19 routing-load distinction)
  if (is_loading) {
    return withMarket({
      state: 'loading',
      state_detail: 'routing-load',
      freshness: 'current',
      action_blocked: false
    });
  }

  // Priority 13: genuinely empty dataset (no items, no error — never config/auth failure)
  if (is_genuinely_empty) {
    return withMarket({
      state: 'empty',
      state_detail: empty_detail,
      freshness: 'current',
      action_blocked: false
    });
  }

  // Default: loading/routing-load (safe conservative — route rendered, awaiting data)
  return withMarket({
    state: 'loading',
    state_detail: 'routing-load',
    freshness: 'current',
    action_blocked: false
  });
}
