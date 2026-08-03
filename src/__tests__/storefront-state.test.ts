/**
 * Story v170-6-2: Unit tests for storefront runtime state resolver and signal.
 *
 * Coverage (AC1/AC2/AC3 — Story 6.2):
 *   (a) Each of the 10 canonical state tokens resolves from canonical inputs
 *   (b) Missing/empty market_id forces `unavailable` (never empty/loading)
 *   (c) Authz failures resolve to `access_denied` (never empty)
 *   (d) Empty state differentiates initial/no-results/permission-denied/load-error sub-modes
 *   (e) Loading state differentiates routing-load/submit-load
 *   (f) Freshness stale/missing → unavailable (anti-silent-fallback, AC3)
 *   (g) STOREFRONT_STATE_TOKENS constant has exactly 10 entries in correct order
 *   (h) logStorefrontStateEvaluated level escalation mirrors Story 2.9 pattern
 *   (i) STOREFRONT_SURFACES list contract
 *   (j) StorefrontStateSignal DOM signal has required data-* attributes
 */

import { describe, expect, it, vi } from 'vitest';

import {
  resolveStorefrontState,
  STOREFRONT_STATE_DETAIL_TOKENS,
  STOREFRONT_STATE_TOKENS,
  type StorefrontStateToken
} from '@/lib/helpers/storefront-state';

// ---------------------------------------------------------------------------
// STOREFRONT_STATE_TOKENS constant
// ---------------------------------------------------------------------------

describe('STOREFRONT_STATE_TOKENS constant', () => {
  it('contains exactly the 10 canonical tokens in contract order', () => {
    expect(STOREFRONT_STATE_TOKENS).toEqual([
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
    ]);
  });

  it('has exactly 10 entries', () => {
    expect(STOREFRONT_STATE_TOKENS).toHaveLength(10);
  });
});

describe('STOREFRONT_STATE_DETAIL_TOKENS constant', () => {
  it('includes empty sub-modes from UX-DR19', () => {
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('initial');
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('no-results');
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('permission-denied');
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('load-error');
  });

  it('includes loading sub-modes from UX-DR19', () => {
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('routing-load');
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('submit-load');
  });

  it('includes unavailability sub-modes', () => {
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('market-unknown');
    expect(STOREFRONT_STATE_DETAIL_TOKENS).toContain('provider-unavailable');
  });
});

// ---------------------------------------------------------------------------
// resolveStorefrontState — each of the 10 tokens resolves (AC1)
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — 10 canonical states (AC1)', () => {
  const market = 'bonbeauty-pl';

  it('resolves loading/routing-load from is_loading=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_loading: true });
    expect(r.state).toBe('loading');
    expect(r.state_detail).toBe('routing-load');
    expect(r.market_id).toBe(market);
    expect(r.action_blocked).toBe(false);
  });

  it('resolves loading/submit-load from is_submitting=true (takes priority over is_loading)', () => {
    const r = resolveStorefrontState({ market_id: market, is_submitting: true, is_loading: true });
    // submit-load has higher priority
    expect(r.state).toBe('loading');
    expect(r.state_detail).toBe('submit-load');
  });

  it('resolves empty/no-results from is_genuinely_empty=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_genuinely_empty: true });
    expect(r.state).toBe('empty');
    expect(r.state_detail).toBe('no-results');
    expect(r.action_blocked).toBe(false);
  });

  it('resolves empty/initial when empty_detail="initial"', () => {
    const r = resolveStorefrontState({
      market_id: market,
      is_genuinely_empty: true,
      empty_detail: 'initial'
    });
    expect(r.state).toBe('empty');
    expect(r.state_detail).toBe('initial');
  });

  it('resolves validation from has_validation_error=true', () => {
    const r = resolveStorefrontState({ market_id: market, has_validation_error: true });
    expect(r.state).toBe('validation');
    expect(r.action_blocked).toBe(false);
  });

  it('resolves unavailable/provider-unavailable from is_unavailable=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_unavailable: true });
    expect(r.state).toBe('unavailable');
    expect(r.state_detail).toBe('provider-unavailable');
    expect(r.action_blocked).toBe(true);
  });

  it('resolves access_denied/permission-denied from is_access_denied=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_access_denied: true });
    expect(r.state).toBe('access_denied');
    expect(r.state_detail).toBe('permission-denied');
    expect(r.action_blocked).toBe(false);
  });

  it('resolves stale/freshness-stale from is_stale=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_stale: true });
    expect(r.state).toBe('stale');
    expect(r.state_detail).toBe('freshness-stale');
    expect(r.freshness).toBe('stale');
  });

  it('resolves pending from is_pending=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_pending: true });
    expect(r.state).toBe('pending');
    expect(r.action_blocked).toBe(false);
  });

  it('resolves failed/load-error from has_failed=true', () => {
    const r = resolveStorefrontState({ market_id: market, has_failed: true });
    expect(r.state).toBe('failed');
    expect(r.state_detail).toBe('load-error');
  });

  it('resolves retry from is_retrying=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_retrying: true });
    expect(r.state).toBe('retry');
    expect(r.action_blocked).toBe(false);
  });

  it('resolves recovered from is_recovered=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_recovered: true });
    expect(r.state).toBe('recovered');
    expect(r.action_blocked).toBe(false);
  });

  it('defaults to loading/routing-load when no flags set (safe conservative)', () => {
    const r = resolveStorefrontState({ market_id: market });
    expect(r.state).toBe('loading');
    expect(r.state_detail).toBe('routing-load');
    expect(r.action_blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// anti-silent-fallback: missing/empty market_id → unavailable (AC3)
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — market_id guard (AC3 anti-silent-fallback)', () => {
  it('MUST return unavailable when market_id is empty string — never empty', () => {
    const r = resolveStorefrontState({ market_id: '' });
    expect(r.state).toBe('unavailable');
    expect(r.state_detail).toBe('market-unknown');
    expect(r.market_id).toBe('unknown');
    expect(r.action_blocked).toBe(true);
    expect(r.freshness).toBe('missing');
  });

  it('returns unavailable when getMarketId() falls back to empty (no env)', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', '');
    const r = resolveStorefrontState({});
    expect(r.state).toBe('unavailable');
    expect(r.action_blocked).toBe(true);
    vi.unstubAllEnvs();
  });

  it('does NOT return empty when market_id is missing', () => {
    const r = resolveStorefrontState({ market_id: '' });
    expect(r.state).not.toBe('empty');
    expect(r.state).not.toBe('loading');
  });

  it('does not block when market_id is provided non-empty', () => {
    const r = resolveStorefrontState({ market_id: 'bonbeauty-pl' });
    expect(r.state).toBe('loading'); // default
    expect(r.action_blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// authz guard: access_denied NEVER rendered as empty (AC1)
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — access_denied guard (AC1)', () => {
  it('access_denied is NEVER rendered as empty', () => {
    const r = resolveStorefrontState({ market_id: 'bonbeauty-pl', is_access_denied: true });
    expect(r.state).toBe('access_denied');
    expect(r.state).not.toBe('empty');
  });

  it('access_denied takes priority over is_genuinely_empty', () => {
    const r = resolveStorefrontState({
      market_id: 'bonbeauty-pl',
      is_access_denied: true,
      is_genuinely_empty: true
    });
    expect(r.state).toBe('access_denied');
  });

  it('access_denied takes priority over is_loading', () => {
    const r = resolveStorefrontState({
      market_id: 'bonbeauty-pl',
      is_access_denied: true,
      is_loading: true
    });
    expect(r.state).toBe('access_denied');
  });
});

// ---------------------------------------------------------------------------
// freshness guard: stale/missing → unavailable (AC3)
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — freshness guard (AC3)', () => {
  it('freshness=stale → unavailable/freshness-stale with action_blocked', () => {
    const r = resolveStorefrontState({ market_id: 'bonbeauty-pl', freshness: 'stale' });
    expect(r.state).toBe('unavailable');
    expect(r.state_detail).toBe('freshness-stale');
    expect(r.action_blocked).toBe(true);
    expect(r.freshness).toBe('stale');
  });

  it('freshness=missing → unavailable/freshness-missing with action_blocked', () => {
    const r = resolveStorefrontState({ market_id: 'bonbeauty-pl', freshness: 'missing' });
    expect(r.state).toBe('unavailable');
    expect(r.state_detail).toBe('freshness-missing');
    expect(r.action_blocked).toBe(true);
  });

  it('stale freshness does NOT silently fall to empty', () => {
    const r = resolveStorefrontState({
      market_id: 'bonbeauty-pl',
      freshness: 'stale',
      is_genuinely_empty: true
    });
    expect(r.state).not.toBe('empty');
    expect(r.state).toBe('unavailable');
  });
});

// ---------------------------------------------------------------------------
// empty state sub-modes (UX-DR19)
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — empty state sub-modes (UX-DR19)', () => {
  const market = 'bonbeauty-pl';

  it('empty defaults to no-results detail', () => {
    const r = resolveStorefrontState({ market_id: market, is_genuinely_empty: true });
    expect(r.state_detail).toBe('no-results');
  });

  it('empty/initial sub-mode', () => {
    const r = resolveStorefrontState({
      market_id: market,
      is_genuinely_empty: true,
      empty_detail: 'initial'
    });
    expect(r.state_detail).toBe('initial');
  });

  it('empty/permission-denied sub-mode', () => {
    const r = resolveStorefrontState({
      market_id: market,
      is_genuinely_empty: true,
      empty_detail: 'permission-denied'
    });
    expect(r.state_detail).toBe('permission-denied');
  });

  it('empty/load-error sub-mode', () => {
    const r = resolveStorefrontState({
      market_id: market,
      is_genuinely_empty: true,
      empty_detail: 'load-error'
    });
    expect(r.state_detail).toBe('load-error');
  });
});

// ---------------------------------------------------------------------------
// loading state: routing-load vs submit-load (UX-DR19, AC2)
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — loading sub-modes (UX-DR19 AC2)', () => {
  const market = 'bonbeauty-pl';

  it('routing-load from is_loading=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_loading: true });
    expect(r.state).toBe('loading');
    expect(r.state_detail).toBe('routing-load');
  });

  it('submit-load from is_submitting=true', () => {
    const r = resolveStorefrontState({ market_id: market, is_submitting: true });
    expect(r.state).toBe('loading');
    expect(r.state_detail).toBe('submit-load');
  });

  it('submit-load takes priority over routing-load when both set', () => {
    const r = resolveStorefrontState({ market_id: market, is_loading: true, is_submitting: true });
    expect(r.state_detail).toBe('submit-load');
  });
});

// ---------------------------------------------------------------------------
// DOM signal contract (AC3): result has all required data-* attributes
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — DOM signal contract (AC3)', () => {
  it('result has all required fields for DOM data-* attributes', () => {
    const r = resolveStorefrontState({ market_id: 'bonbeauty-pl' });
    expect(r).toHaveProperty('state');
    expect(r).toHaveProperty('state_detail');
    expect(r).toHaveProperty('market_id');
    expect(r).toHaveProperty('freshness');
    expect(r).toHaveProperty('action_blocked');
  });

  it('state is always one of the 10 canonical tokens', () => {
    const testCases = [
      { market_id: 'bonbeauty-pl' },
      { market_id: 'bonbeauty-pl', is_loading: true },
      { market_id: 'bonbeauty-pl', is_submitting: true },
      { market_id: 'bonbeauty-pl', is_genuinely_empty: true },
      { market_id: 'bonbeauty-pl', is_access_denied: true },
      { market_id: 'bonbeauty-pl', is_unavailable: true },
      { market_id: 'bonbeauty-pl', has_failed: true },
      { market_id: 'bonbeauty-pl', is_retrying: true },
      { market_id: 'bonbeauty-pl', is_recovered: true },
      { market_id: 'bonbeauty-pl', is_pending: true },
      { market_id: '' },
      { market_id: 'bonbeauty-pl', freshness: 'stale' as const },
      { market_id: 'bonbeauty-pl', freshness: 'missing' as const }
    ];
    for (const input of testCases) {
      const r = resolveStorefrontState(input);
      expect(STOREFRONT_STATE_TOKENS as readonly StorefrontStateToken[]).toContain(r.state);
    }
  });

  it('state_detail is either a valid detail token or null', () => {
    const r = resolveStorefrontState({ market_id: 'bonbeauty-pl' });
    if (r.state_detail !== null) {
      expect(STOREFRONT_STATE_DETAIL_TOKENS as readonly string[]).toContain(r.state_detail);
    }
  });
});

// ---------------------------------------------------------------------------
// logStorefrontStateEvaluated level escalation (mirrors Story 2.9 pattern)
// ---------------------------------------------------------------------------

describe('logStorefrontStateEvaluated — level escalation', () => {
  it('escalates to logger.error when action_blocked=true', async () => {
    vi.resetModules();
    const errorSpy = vi.fn();
    const warnSpy = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      logger: { error: errorSpy, warn: warnSpy }
    }));
    const { logStorefrontStateEvaluated } = await import('@/lib/helpers/storefront-state-logger');
    logStorefrontStateEvaluated(
      {
        state: 'unavailable',
        state_detail: 'market-unknown',
        market_id: 'unknown',
        freshness: 'missing',
        action_blocked: true
      },
      'home',
      'home'
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    vi.doUnmock('@/lib/logger');
    vi.resetModules();
  });

  it('emits logger.warn when action_blocked=false', async () => {
    vi.resetModules();
    const errorSpy = vi.fn();
    const warnSpy = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      logger: { error: errorSpy, warn: warnSpy }
    }));
    const { logStorefrontStateEvaluated } = await import('@/lib/helpers/storefront-state-logger');
    logStorefrontStateEvaluated(
      {
        state: 'loading',
        state_detail: 'routing-load',
        market_id: 'bonbeauty-pl',
        freshness: 'current',
        action_blocked: false
      },
      'home',
      'home'
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    vi.doUnmock('@/lib/logger');
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------------
// STOREFRONT_SURFACES contract
// ---------------------------------------------------------------------------

describe('STOREFRONT_SURFACES contract', () => {
  it('includes all critical-path surfaces from the UX state contract', async () => {
    const { STOREFRONT_SURFACES } = await import('@/lib/helpers/storefront-state-logger');
    const criticalSurfaces = [
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
      'legal-regulamin',
      'legal-polityka-prywatnosci',
      'legal-zasady',
      'legal-pomoc',
      'unknown'
    ];
    for (const surface of criticalSurfaces) {
      expect(STOREFRONT_SURFACES as readonly string[]).toContain(surface);
    }
  });
});

// ---------------------------------------------------------------------------
// Priority ordering — higher-priority states take precedence
// ---------------------------------------------------------------------------

describe('resolveStorefrontState — priority ordering', () => {
  const market = 'bonbeauty-pl';

  it('access_denied beats unavailable', () => {
    const r = resolveStorefrontState({
      market_id: market,
      is_access_denied: true,
      is_unavailable: true
    });
    expect(r.state).toBe('access_denied');
  });

  it('unavailable beats failed', () => {
    const r = resolveStorefrontState({ market_id: market, is_unavailable: true, has_failed: true });
    expect(r.state).toBe('unavailable');
  });

  it('failed beats pending', () => {
    const r = resolveStorefrontState({ market_id: market, has_failed: true, is_pending: true });
    expect(r.state).toBe('failed');
  });

  it('freshness guard beats access_denied', () => {
    const r = resolveStorefrontState({
      market_id: market,
      freshness: 'missing',
      is_access_denied: true
    });
    expect(r.state).toBe('unavailable');
  });
});
