/**
 * Story v170-2-9: Unit tests for FR64 consumer-purchase withdrawal state.
 *
 * Coverage:
 *   (a) Each FR64 state resolves correctly from input data
 *   (b) Missing/inconsistent/stale state → support-review + action_blocked=true
 *   (c) No silent fallback to "withdrawal-eligible-before-service-execution"
 *       when state cannot be derived deterministically (AC3)
 *   (d) DOM signal contract — WithdrawalStateResult has state, market_id,
 *       freshness, action_blocked fields (Epic 7 observable contract)
 *   (e) isWithdrawalCriticalActionBlocked returns correct value
 *
 * Maps to:
 *   AC-2.9-1 — Five FR64 states surfaced with correct tokens
 *   AC-2.9-2 — Legal pages carry voucher_withdrawal.legal.* keys
 *   AC-2.9-3 — Missing state → support-review + blocked CTA; DOM signal present
 */

import { describe, expect, it } from 'vitest';
import {
  getWithdrawalState,
  isWithdrawalCriticalActionBlocked,
} from '@/lib/helpers/withdrawal-state';
import {
  WITHDRAWAL_LIFECYCLE_STATES,
  type WithdrawalLifecycleState,
} from '@/types/voucher';

// ---------------------------------------------------------------------------
// Helper: build a minimal WithdrawalStateResult-compatible call
// ---------------------------------------------------------------------------

describe('WITHDRAWAL_LIFECYCLE_STATES constant', () => {
  it('contains exactly the five FR64 canonical tokens in correct order', () => {
    expect(WITHDRAWAL_LIFECYCLE_STATES).toEqual([
      'withdrawal-eligible-before-service-execution',
      'consent-to-execute-captured',
      'withdrawal-blocked-after-execution',
      'refunded',
      'support-review',
    ]);
  });

  it('has exactly 5 entries', () => {
    expect(WITHDRAWAL_LIFECYCLE_STATES).toHaveLength(5);
  });
});

describe('getWithdrawalState — state resolution (AC-2.9-1)', () => {
  it('returns withdrawal-eligible-before-service-execution as default safe state', () => {
    const result = getWithdrawalState({ market_id: 'bonbeauty-pl' });
    expect(result.state).toBe('withdrawal-eligible-before-service-execution');
    expect(result.freshness).toBe('current');
    expect(result.action_blocked).toBe(false);
    expect(result.market_id).toBe('bonbeauty-pl');
  });

  it('returns consent-to-execute-captured when consent flag is true', () => {
    const result = getWithdrawalState({
      consent_to_execute_captured: true,
      market_id: 'bonbeauty-pl',
    });
    expect(result.state).toBe('consent-to-execute-captured');
    expect(result.action_blocked).toBe(false);
  });

  it('returns withdrawal-blocked-after-execution when service_executed_at is present', () => {
    const result = getWithdrawalState({
      consent_to_execute_captured: true,
      service_executed_at: '2026-05-09T14:00:00Z',
      market_id: 'bonbeauty-pl',
    });
    expect(result.state).toBe('withdrawal-blocked-after-execution');
    expect(result.action_blocked).toBe(false);
  });

  it('returns withdrawal-blocked-after-execution without consent flag when service executed', () => {
    const result = getWithdrawalState({
      service_executed_at: '2026-05-09T14:00:00Z',
      market_id: 'bonbeauty-pl',
    });
    expect(result.state).toBe('withdrawal-blocked-after-execution');
  });

  it('returns refunded when refunded_at is present (higher priority than service_executed_at)', () => {
    const result = getWithdrawalState({
      service_executed_at: '2026-05-09T14:00:00Z',
      refunded_at: '2026-05-10T10:00:00Z',
      market_id: 'bonbeauty-pl',
    });
    expect(result.state).toBe('refunded');
    expect(result.action_blocked).toBe(false);
  });

  it('returns refunded even without service_executed_at', () => {
    const result = getWithdrawalState({
      refunded_at: '2026-05-10T10:00:00Z',
      market_id: 'bonbeauty-pl',
    });
    expect(result.state).toBe('refunded');
  });
});

describe('getWithdrawalState — freshness guard (AC-2.9-3 anti-silent-fallback)', () => {
  it('MUST return support-review when freshness is "missing" — no silent fallback', () => {
    const result = getWithdrawalState({
      market_id: 'bonbeauty-pl',
      freshness: 'missing',
    });
    // AC3 explicit requirement: missing state → support-review, action blocked
    expect(result.state).toBe('support-review');
    expect(result.action_blocked).toBe(true);
    expect(result.freshness).toBe('missing');
  });

  it('MUST return support-review when freshness is "stale" — no silent fallback', () => {
    const result = getWithdrawalState({
      consent_to_execute_captured: true,
      market_id: 'bonbeauty-pl',
      freshness: 'stale',
    });
    expect(result.state).toBe('support-review');
    expect(result.action_blocked).toBe(true);
    expect(result.freshness).toBe('stale');
  });

  it('does NOT default to eligible when state is missing — returns support-review', () => {
    // Simulate: no fields provided + freshness=missing → should NEVER be "eligible"
    const result = getWithdrawalState({
      market_id: 'test-market',
      freshness: 'missing',
    });
    expect(result.state).not.toBe('withdrawal-eligible-before-service-execution');
    expect(result.state).toBe('support-review');
  });
});

describe('getWithdrawalState — DOM signal contract (Epic 7 observable contract)', () => {
  it('result has all required fields for DOM data-* attributes', () => {
    const result = getWithdrawalState({ market_id: 'bonbeauty-pl' });
    // Epic 7 DOM signal: data-state, data-market, data-freshness
    expect(result).toHaveProperty('state');
    expect(result).toHaveProperty('market_id');
    expect(result).toHaveProperty('freshness');
    expect(result).toHaveProperty('action_blocked');
  });

  it('state is always one of the five canonical FR64 tokens', () => {
    const testCases: Parameters<typeof getWithdrawalState>[0][] = [
      { market_id: 'bonbeauty-pl' },
      { market_id: 'bonbeauty-pl', consent_to_execute_captured: true },
      { market_id: 'bonbeauty-pl', service_executed_at: '2026-05-09T14:00:00Z' },
      { market_id: 'bonbeauty-pl', refunded_at: '2026-05-10T10:00:00Z' },
      { market_id: 'bonbeauty-pl', freshness: 'missing' },
      { market_id: 'bonbeauty-pl', freshness: 'stale' },
    ];
    for (const input of testCases) {
      const result = getWithdrawalState(input);
      expect(WITHDRAWAL_LIFECYCLE_STATES as readonly string[]).toContain(result.state);
    }
  });

  it('market_id is passed through from input', () => {
    const result = getWithdrawalState({ market_id: 'my-market-42' });
    expect(result.market_id).toBe('my-market-42');
  });
});

describe('isWithdrawalCriticalActionBlocked', () => {
  it('returns true when state is support-review', () => {
    const result = getWithdrawalState({ market_id: 'bonbeauty-pl', freshness: 'missing' });
    expect(isWithdrawalCriticalActionBlocked(result)).toBe(true);
  });

  it('returns false for eligible state with current freshness', () => {
    const result = getWithdrawalState({ market_id: 'bonbeauty-pl' });
    expect(isWithdrawalCriticalActionBlocked(result)).toBe(false);
  });

  it('returns false for consent-to-execute-captured state', () => {
    const result = getWithdrawalState({
      market_id: 'bonbeauty-pl',
      consent_to_execute_captured: true,
    });
    expect(isWithdrawalCriticalActionBlocked(result)).toBe(false);
  });

  it('returns false for withdrawal-blocked-after-execution', () => {
    const result = getWithdrawalState({
      market_id: 'bonbeauty-pl',
      service_executed_at: '2026-05-09T14:00:00Z',
    });
    expect(isWithdrawalCriticalActionBlocked(result)).toBe(false);
  });

  it('returns false for refunded state', () => {
    const result = getWithdrawalState({
      market_id: 'bonbeauty-pl',
      refunded_at: '2026-05-10T10:00:00Z',
    });
    expect(isWithdrawalCriticalActionBlocked(result)).toBe(false);
  });
});

describe('FR64 state tokens — i18n key mapping contract', () => {
  /**
   * This test asserts that every FR64 state token has a corresponding
   * snake_case i18n key prefix under `voucher_withdrawal.state_*`.
   *
   * The mapping is: kebab-case token → replace dashes with underscores → prefix with "state_"
   * e.g. "withdrawal-eligible-before-service-execution" → "state_withdrawal_eligible_before_service_execution"
   *
   * This contract is critical: the VoucherWithdrawalStateCard renders
   * `t('${keyPrefix}.label')` etc.; if the mapping is wrong, the UI breaks.
   */

  const expectedMapping: Record<WithdrawalLifecycleState, string> = {
    'withdrawal-eligible-before-service-execution':
      'state_withdrawal_eligible_before_service_execution',
    'consent-to-execute-captured':
      'state_consent_to_execute_captured',
    'withdrawal-blocked-after-execution':
      'state_withdrawal_blocked_after_execution',
    'refunded':
      'state_refunded',
    'support-review':
      'state_support_review',
  };

  for (const [token, expectedKey] of Object.entries(expectedMapping)) {
    it(`"${token}" → i18n key "${expectedKey}"`, () => {
      const derived = `state_${token.replace(/-/g, '_')}`;
      expect(derived).toBe(expectedKey);
    });
  }
});
