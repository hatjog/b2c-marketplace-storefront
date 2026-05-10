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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
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

describe('getWithdrawalState — wrong-market guard (review fix H2)', () => {
  it('returns support-review when market_id is empty string (AC3 wrong-market)', () => {
    const result = getWithdrawalState({ market_id: '' });
    expect(result.state).toBe('support-review');
    expect(result.action_blocked).toBe(true);
    expect(result.freshness).toBe('missing');
  });

  it('returns support-review when getMarketId() falls back to empty (no env)', () => {
    // No market_id provided + dev fallback (NEXT_PUBLIC_PAYLOAD_MARKET_ID unset)
    // would resolve to "" — must NOT return eligible state.
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', '');
    const result = getWithdrawalState({});
    expect(result.state).toBe('support-review');
    expect(result.action_blocked).toBe(true);
    vi.unstubAllEnvs();
  });

  it('does NOT block when market_id is provided non-empty', () => {
    const result = getWithdrawalState({ market_id: 'bonbeauty-pl' });
    expect(result.state).toBe('withdrawal-eligible-before-service-execution');
    expect(result.action_blocked).toBe(false);
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

describe('voucher_withdrawal i18n — status_token parity across locales (review fix M5)', () => {
  /**
   * Each locale's `voucher_withdrawal.state_*.status_token` MUST equal the
   * canonical kebab-case FR64 token. This guards against silent locale drift
   * where a translator could change the token value to a localized string.
   */
  const expectedTokens: Record<string, string> = {
    state_withdrawal_eligible_before_service_execution: 'withdrawal-eligible-before-service-execution',
    state_consent_to_execute_captured: 'consent-to-execute-captured',
    state_withdrawal_blocked_after_execution: 'withdrawal-blocked-after-execution',
    state_refunded: 'refunded',
    state_support_review: 'support-review',
  };

  for (const locale of ['pl', 'en', 'ua', 'de'] as const) {
    it(`${locale}.json status_token values match canonical FR64 tokens`, () => {
      const path = join(process.cwd(), 'messages', `${locale}.json`);
      const raw = readFileSync(path, 'utf-8');
      const data = JSON.parse(raw) as {
        voucher_withdrawal?: Record<string, { status_token?: string }>;
      };
      const vw = data.voucher_withdrawal ?? {};
      for (const [key, expected] of Object.entries(expectedTokens)) {
        expect(vw[key]?.status_token, `${locale} ${key}.status_token`).toBe(expected);
      }
    });
  }
});

describe('logWithdrawalStateEvaluated — level escalation (review fix H4)', () => {
  it('escalates to logger.error when action_blocked=true', async () => {
    vi.resetModules();
    const errorSpy = vi.fn();
    const warnSpy = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      logger: { error: errorSpy, warn: warnSpy },
    }));
    const { logWithdrawalStateEvaluated } = await import(
      '@/lib/helpers/withdrawal-state-logger'
    );
    logWithdrawalStateEvaluated(
      {
        state: 'support-review',
        market_id: 'bonbeauty-pl',
        freshness: 'missing',
        action_blocked: true,
      },
      'checkout'
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
      logger: { error: errorSpy, warn: warnSpy },
    }));
    const { logWithdrawalStateEvaluated } = await import(
      '@/lib/helpers/withdrawal-state-logger'
    );
    logWithdrawalStateEvaluated(
      {
        state: 'withdrawal-eligible-before-service-execution',
        market_id: 'bonbeauty-pl',
        freshness: 'current',
        action_blocked: false,
      },
      'voucher-card'
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    vi.doUnmock('@/lib/logger');
    vi.resetModules();
  });
});

describe('WITHDRAWAL_SURFACES — story Dev Notes contract (review fix L2)', () => {
  it('exposes exactly the documented surface tokens', async () => {
    const { WITHDRAWAL_SURFACES } = await import(
      '@/lib/helpers/withdrawal-state-logger'
    );
    expect(WITHDRAWAL_SURFACES).toEqual([
      'checkout',
      'confirmation-handoff',
      'voucher-recovery',
      'voucher-card',
      'legal-help',
      'unknown',
    ]);
  });

  it('WITHDRAWAL_LOG_SURFACES excludes legal-help (second-pass review fix M5)', async () => {
    const { WITHDRAWAL_LOG_SURFACES, WITHDRAWAL_SURFACES } = await import(
      '@/lib/helpers/withdrawal-state-logger'
    );
    // legal-help is DOM-signal-only; not a valid log surface
    expect(WITHDRAWAL_LOG_SURFACES).not.toContain('legal-help');
    // All log surfaces are a strict subset of DOM surfaces
    for (const s of WITHDRAWAL_LOG_SURFACES) {
      expect(WITHDRAWAL_SURFACES as readonly string[]).toContain(s);
    }
    // Exact contract: log surfaces are the real-flow ones plus 'unknown'
    expect(WITHDRAWAL_LOG_SURFACES).toEqual([
      'checkout',
      'confirmation-handoff',
      'voucher-recovery',
      'voucher-card',
      'unknown',
    ]);
  });
});

describe('voucher_withdrawal.legal.contact_support_href — locale parity (second-pass review fix H1)', () => {
  // EN/UA/DE used to ship "/help" which is a 404; align all four locales to /pomoc
  // until locale-aware route segments (multi-market expansion) re-introduce per-locale variants.
  for (const locale of ['pl', 'en', 'ua', 'de'] as const) {
    it(`${locale}.json voucher_withdrawal.legal.contact_support_href === "/pomoc"`, () => {
      const path = join(process.cwd(), 'messages', `${locale}.json`);
      const raw = readFileSync(path, 'utf-8');
      const data = JSON.parse(raw) as {
        voucher_withdrawal?: { legal?: { contact_support_href?: string } };
      };
      expect(data.voucher_withdrawal?.legal?.contact_support_href).toBe('/pomoc');
    });
  }
});

describe('Legal-page hrefs — locale-aware (second-pass review fix H2)', () => {
  /**
   * Lightweight string-scan ensures the new and edited legal pages interpolate
   * the [locale] segment rather than linking to bare /pomoc, /regulamin, etc.
   * Catches the regression flagged in the second-pass review.
   */
  it.each([
    'src/app/[locale]/(main)/regulamin/page.tsx',
    'src/app/[locale]/(main)/zasady/page.tsx',
    'src/app/[locale]/(main)/polityka-prywatnosci/page.tsx',
  ])('%s contains no bare href="/pomoc" / "/regulamin" / "/zasady"', (relPath) => {
    const path = join(process.cwd(), relPath);
    const text = readFileSync(path, 'utf-8');
    // Match a bare href attribute (string-literal, no template expression)
    expect(text).not.toMatch(/href=["']\/pomoc["']/);
    expect(text).not.toMatch(/href=["']\/regulamin["']/);
    // /zasady has historically been linked locale-bare elsewhere, but this
    // story did not introduce that pattern. Guard against future drift.
    expect(text).not.toMatch(/href=["']\/zasady["']/);
  });
});

describe('Deferred backing-data documentation (review fix M5)', () => {
  /**
   * Mercur 2 voucher payload does not yet expose `consent_to_execute_captured`,
   * `service_executed_at`, `refunded_at`. The helper handles the gap by
   * conservatively defaulting (no silent progression to refunded/blocked
   * states based on side-channel inference). This test guards the deferral
   * documentation in the helper module so it is not silently removed.
   *
   * FOLLOWUP: when Story 6.x or Epic 7 wires the backing fields, remove this
   * test and replace with positive-flow tests against real payloads.
   */
  it('helper module JSDoc explicitly lists deferred backing-data fields', () => {
    const path = join(process.cwd(), 'src', 'lib', 'helpers', 'withdrawal-state.ts');
    const text = readFileSync(path, 'utf-8');
    expect(text).toMatch(/Deferred backing-data work/);
    expect(text).toMatch(/consent_to_execute_captured/);
    expect(text).toMatch(/service_executed_at/);
    expect(text).toMatch(/refunded_at/);
  });
});
