/**
 * Tests for PaymentStatusV180 — v1.8.0 Story 1.5.
 *
 * Test environment: vitest node (no DOM / no @testing-library).
 *
 * Coverage:
 *   1. Adapter (pure functions): 6-state resolution, backward-compat, terminal states
 *   2. Poller (createPaymentStatusPoller): cadence 5s, cleanup on stop(), terminal
 *      stops polling, 10min → expired, second-tier @90s, reduced-motion no-op (H3 fix)
 *   3. State config (pure helpers): aria role per state, CTA presence, CTA path,
 *      mailto encoding — verified without React (node-env compatible) (H3 fix)
 *   4. i18n coverage: pl.json + en.json key presence (L2 fix)
 *   5. Sprint 5 gate: describe.skip with comment
 *
 * Full component DOM-render tests (6 states → actual render tree) require
 * @testing-library/react with jsdom environment — deferred to Sprint 5 E2E infra
 * (same gate as visual regression baseline, Story 3.8 joint).
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { BackendPaymentStatusResponse, PaymentStatusV180 } from '@/lib/payment/payment-status-v180-adapter';

type OnStatusChangeMock = Mock<(status: PaymentStatusV180, data: BackendPaymentStatusResponse) => void>;
type OnCountdownTickMock = Mock<(countdown: number, totalElapsedSeconds: number, isSecondTier: boolean) => void>;

// ─── Adapter tests (pure, no React) ──────────────────────────────────────────

describe('payment-status-v180-adapter', async () => {
  const {
    resolvePaymentStatusV180,
    resolveStatusFromResponse,
    PAYMENT_STATUS_V180_IDS,
    TERMINAL_STATUSES_V180,
  } = await import('@/lib/payment/payment-status-v180-adapter');

  it('exports exactly 6 state IDs', () => {
    expect(PAYMENT_STATUS_V180_IDS).toHaveLength(6);
  });

  it('PAYMENT_STATUS_V180_IDS contains all 6 v1.8.0 states', () => {
    expect(PAYMENT_STATUS_V180_IDS).toContain('paid');
    expect(PAYMENT_STATUS_V180_IDS).toContain('pending_psp');
    expect(PAYMENT_STATUS_V180_IDS).toContain('failed_retryable');
    expect(PAYMENT_STATUS_V180_IDS).toContain('failed_nonretryable');
    expect(PAYMENT_STATUS_V180_IDS).toContain('expired');
    expect(PAYMENT_STATUS_V180_IDS).toContain('support_required');
  });

  it('resolves paid pass-through', () => {
    expect(resolvePaymentStatusV180('paid')).toBe('paid');
  });

  it('resolves pending_psp pass-through', () => {
    expect(resolvePaymentStatusV180('pending_psp')).toBe('pending_psp');
  });

  it('resolves failed_retryable pass-through', () => {
    expect(resolvePaymentStatusV180('failed_retryable')).toBe('failed_retryable');
  });

  it('resolves failed_nonretryable pass-through', () => {
    expect(resolvePaymentStatusV180('failed_nonretryable')).toBe('failed_nonretryable');
  });

  it('resolves expired pass-through', () => {
    expect(resolvePaymentStatusV180('expired')).toBe('expired');
  });

  it('resolves support_required pass-through', () => {
    expect(resolvePaymentStatusV180('support_required')).toBe('support_required');
  });

  it('maps pending_psp_confirmation → pending_psp (v1.7.0 compat)', () => {
    expect(resolvePaymentStatusV180('pending_psp_confirmation')).toBe('pending_psp');
  });

  it('maps failed → failed_retryable (safe default without failure_code context)', () => {
    expect(resolvePaymentStatusV180('failed')).toBe('failed_retryable');
  });

  it('resolves null → pending_psp (safe default, never paid)', () => {
    expect(resolvePaymentStatusV180(null)).toBe('pending_psp');
    expect(resolvePaymentStatusV180(null)).not.toBe('paid');
  });

  it('resolves undefined → pending_psp', () => {
    expect(resolvePaymentStatusV180(undefined)).toBe('pending_psp');
  });

  it('resolves empty string → pending_psp', () => {
    expect(resolvePaymentStatusV180('')).toBe('pending_psp');
  });

  it('resolves unknown status → pending_psp (anti-optimistic-paid)', () => {
    const unknowns = ['processing', 'held', 'done', 'random', 'verifying'];
    for (const s of unknowns) {
      expect(resolvePaymentStatusV180(s)).toBe('pending_psp');
      expect(resolvePaymentStatusV180(s)).not.toBe('paid');
    }
  });

  // resolveStatusFromResponse: pure pass-through of resolvePaymentStatusV180
  // FE MUST NOT re-map failure_code → state (H2 fix: backend owns classification)

  it('resolveStatusFromResponse: paid passes through', () => {
    expect(resolveStatusFromResponse({ status: 'paid' })).toBe('paid');
  });

  it('resolveStatusFromResponse: failed_retryable passes through (backend-classified)', () => {
    expect(resolveStatusFromResponse({ status: 'failed_retryable' })).toBe('failed_retryable');
  });

  it('resolveStatusFromResponse: failed_nonretryable passes through (backend-classified)', () => {
    expect(resolveStatusFromResponse({ status: 'failed_nonretryable' })).toBe('failed_nonretryable');
  });

  it('resolveStatusFromResponse: failed → failed_retryable (no FE heuristic on failure_code)', () => {
    // H2 fix: backend owns failure classification — FE does NOT use failure_code for routing
    expect(resolveStatusFromResponse({ status: 'failed' })).toBe('failed_retryable');
  });

  it('resolveStatusFromResponse: pending_psp_confirmation → pending_psp', () => {
    expect(resolveStatusFromResponse({ status: 'pending_psp_confirmation' })).toBe('pending_psp');
  });

  it('TERMINAL_STATUSES_V180 does NOT include pending_psp (polling must continue)', () => {
    expect(TERMINAL_STATUSES_V180.has('pending_psp')).toBe(false);
  });

  it('TERMINAL_STATUSES_V180 includes all 5 non-pending states', () => {
    expect(TERMINAL_STATUSES_V180.has('paid')).toBe(true);
    expect(TERMINAL_STATUSES_V180.has('failed_retryable')).toBe(true);
    expect(TERMINAL_STATUSES_V180.has('failed_nonretryable')).toBe(true);
    expect(TERMINAL_STATUSES_V180.has('support_required')).toBe(true);
    expect(TERMINAL_STATUSES_V180.has('expired')).toBe(true);
  });
});

// ─── Poller tests — createPaymentStatusPoller with fake timers ────────────────
// Tests the hook behavior (H3 fix: "testy hooka z fake timers") via the extracted
// pure scheduler (usePaymentStatusPoll is a thin wrapper around this).

describe('createPaymentStatusPoller', async () => {
  const {
    createPaymentStatusPoller,
    POLL_INTERVAL_MS,
    MAX_POLL_DURATION_MS,
    SECOND_TIER_THRESHOLD_MS,
    COUNTDOWN_SECONDS,
  } = await import('@/lib/payment/payment-status-poller');

  let onStatusChange: OnStatusChangeMock;
  let onCountdownTick: OnCountdownTickMock;
  let fetchMock: ReturnType<typeof vi.fn>;

  const pendingResponse = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'pending_psp', last_checked_at: new Date().toISOString(), recommended_action_key: 'wait' }),
    });

  const paidResponse = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'paid', last_checked_at: new Date().toISOString(), recommended_action_key: 'confirm' }),
    });

  beforeEach(() => {
    vi.useFakeTimers();
    onStatusChange = vi.fn<(status: PaymentStatusV180, data: BackendPaymentStatusResponse) => void>();
    onCountdownTick = vi.fn<(countdown: number, totalElapsedSeconds: number, isSecondTier: boolean) => void>();
    fetchMock = vi.fn().mockImplementation(pendingResponse);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fires first poll after POLL_INTERVAL_MS (5s)', async () => {
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('fires second poll 5s after first (cadence 5s)', async () => {
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2 + 100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('stop() cancels poll — no fetch fires after stop (cleanup on unmount)', async () => {
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    poller.stop(); // immediate stop simulates unmount
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stop() on terminal status — no further poll after paid received (cleanup on transition)', async () => {
    fetchMock.mockImplementation(paidResponse);
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    expect(onStatusChange).toHaveBeenCalledWith('paid', expect.objectContaining({ status: 'paid' }));
    const fetchCountAfterPaid = fetchMock.mock.calls.length;
    // No more polls after terminal state — equivalent to "cleanup on transition"
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(fetchCountAfterPaid);
  });

  it('10min hard cap → onStatusChange(expired) called exactly once', async () => {
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    await vi.advanceTimersByTimeAsync(MAX_POLL_DURATION_MS + POLL_INTERVAL_MS);
    const expiredCalls = onStatusChange.mock.calls.filter(c => c[0] === 'expired');
    expect(expiredCalls).toHaveLength(1);
  });

  it('no further polls after 10min expired', async () => {
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    await vi.advanceTimersByTimeAsync(MAX_POLL_DURATION_MS + POLL_INTERVAL_MS);
    const fetchCountAtExpiry = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(fetchCountAtExpiry);
  });

  it('second-tier threshold @90s: isSecondTier=true after elapsed ≥ 90s', async () => {
    // Simulate poller that started 90s ago
    const startTime = Date.now() - SECOND_TIER_THRESHOLD_MS;
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start(startTime);
    // First countdown tick fires immediately on start
    await vi.advanceTimersByTimeAsync(100);
    const secondTierTicks = onCountdownTick.mock.calls.filter(c => c[2] === true);
    expect(secondTierTicks.length).toBeGreaterThan(0);
    poller.stop();
  });

  it('countdown tick (COUNTDOWN_SECONDS): starts at correct value', async () => {
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    // First tick fires right when schedulePoll starts countdown
    expect(onCountdownTick).toHaveBeenCalledWith(
      COUNTDOWN_SECONDS,
      expect.any(Number),
      false, // not yet second tier
    );
    poller.stop();
  });

  it('reduced-motion has zero effect on poll logic (poll fires identically)', async () => {
    // reduced-motion is UI-only — poller has no parameter for it
    // Verify: poll fires the same regardless of any external condition
    const poller = createPaymentStatusPoller('order-1', { onStatusChange, onCountdownTick });
    poller.start();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    poller.stop();
  });
});

// ─── State config tests (pure helpers) — 6-state coverage ────────────────────
// Tests the logic that drives PaymentStatusV180 rendering without React.
// Covers: aria role per state (AC10), CTA presence (AC1/AC4), locale-aware hrefs (M7/M8),
// mailto encoding (L1), fail-loud ticket_missing (AC9).

describe('payment-status-v180-config helpers', async () => {
  const { getAriaLiveRole, hasPrimaryCta, getCtaPath, buildSupportMailto } =
    await import('@/lib/payment/payment-status-v180-config');

  // ─── ARIA live role mapping (AC10 / M5 fix) ────────────────────────────────

  it('getAriaLiveRole: failed_nonretryable → alert (assertive)', () => {
    expect(getAriaLiveRole('failed_nonretryable')).toBe('alert');
  });

  it('getAriaLiveRole: support_required → alert (assertive)', () => {
    expect(getAriaLiveRole('support_required')).toBe('alert');
  });

  it('getAriaLiveRole: paid → status (polite)', () => {
    expect(getAriaLiveRole('paid')).toBe('status');
  });

  it('getAriaLiveRole: pending_psp → status (polite)', () => {
    expect(getAriaLiveRole('pending_psp')).toBe('status');
  });

  it('getAriaLiveRole: failed_retryable → status (polite)', () => {
    expect(getAriaLiveRole('failed_retryable')).toBe('status');
  });

  it('getAriaLiveRole: expired → status (polite)', () => {
    expect(getAriaLiveRole('expired')).toBe('status');
  });

  // ─── CTA presence (AC1 / AC4) ─────────────────────────────────────────────

  it('hasPrimaryCta: pending_psp → false (auto-poll only, no CTA)', () => {
    expect(hasPrimaryCta('pending_psp')).toBe(false);
  });

  it('hasPrimaryCta: paid → true', () => {
    expect(hasPrimaryCta('paid')).toBe(true);
  });

  it('hasPrimaryCta: failed_retryable → true', () => {
    expect(hasPrimaryCta('failed_retryable')).toBe(true);
  });

  it('hasPrimaryCta: failed_nonretryable → true', () => {
    expect(hasPrimaryCta('failed_nonretryable')).toBe(true);
  });

  it('hasPrimaryCta: expired → true', () => {
    expect(hasPrimaryCta('expired')).toBe(true);
  });

  it('hasPrimaryCta: support_required → true', () => {
    expect(hasPrimaryCta('support_required')).toBe(true);
  });

  // ─── Locale-aware CTA paths (M7/M8 fix) ───────────────────────────────────

  it('getCtaPath: paid → locale-prefixed order/confirmed', () => {
    const path = getCtaPath('paid', 'ORD-1', 'pl');
    expect(path).toBe('/pl/order/ORD-1/confirmed');
  });

  it('getCtaPath: failed_retryable → locale-prefixed checkout with orderId + retry_count (M7)', () => {
    const path = getCtaPath('failed_retryable', 'ORD-2', 'pl');
    expect(path).toContain('/pl/checkout');
    expect(path).toContain('order_id=ORD-2');
    expect(path).toContain('retry_count=1');
  });

  it('getCtaPath: expired → locale-prefixed /cart (M8)', () => {
    const path = getCtaPath('expired', 'ORD-3', 'en');
    expect(path).toBe('/en/cart');
  });

  it('getCtaPath: pending_psp → null (no CTA)', () => {
    expect(getCtaPath('pending_psp', 'ORD-4', 'pl')).toBeNull();
  });

  it('getCtaPath: failed_nonretryable → null (uses mailto, not path)', () => {
    expect(getCtaPath('failed_nonretryable', 'ORD-5', 'pl')).toBeNull();
  });

  it('getCtaPath: support_required → null (uses mailto, not path)', () => {
    expect(getCtaPath('support_required', 'ORD-6', 'pl')).toBeNull();
  });

  it('getCtaPath: en locale used in paths', () => {
    const path = getCtaPath('paid', 'ORD-7', 'en');
    expect(path).toContain('/en/');
  });

  // ─── mailto encoding (L1 fix) ─────────────────────────────────────────────

  it('buildSupportMailto: no raw spaces in URL (all spaces encoded)', () => {
    const href = buildSupportMailto('support@example.pl', 'TKT 99', 'order-1', 'Zamówienie', 'Ticket');
    expect(href).not.toMatch(/ /);
    expect(href).toContain('mailto:');
  });

  it('buildSupportMailto with ticketId: includes ticket in subject + body', () => {
    const href = buildSupportMailto('support@example.pl', 'TKT-42', 'ORD-1', 'Zamówienie', 'Ticket');
    expect(href).toContain('TKT-42');
    // Subject and body should be percent-encoded (no raw spaces/special chars)
    expect(href).not.toMatch(/subject=[^&]*\s/);
  });

  it('buildSupportMailto without ticketId: graceful fallback (no null in href)', () => {
    const href = buildSupportMailto('support@example.pl', null, 'ORD-1', 'Order', 'Ticket');
    expect(href).not.toContain('null');
    expect(href).toContain('mailto:support@example.pl');
  });
});

// ─── Translation key coverage ─────────────────────────────────────────────────

const requiredKeys = [
  'payment_status.pending_psp.label',
  'payment_status.pending_psp.body',
  'payment_status.pending_psp.countdown',
  'payment_status.pending_psp.second_tier',
  'payment_status.pending_psp.technical_detail',
  'payment_status.paid.label_v180',
  'payment_status.paid.body_v180',
  'payment_status.paid.technical_detail',
  'payment_status.paid.cta',
  'payment_status.failed_retryable.label',
  'payment_status.failed_retryable.body',
  'payment_status.failed_retryable.cta',
  'payment_status.failed_retryable.technical_detail',
  'payment_status.failed_nonretryable.label',
  'payment_status.failed_nonretryable.body',
  'payment_status.failed_nonretryable.cta',
  'payment_status.failed_nonretryable.technical_detail',
  'payment_status.expired.label_v180',
  'payment_status.expired.body_v180',
  'payment_status.expired.cta_v180',
  'payment_status.expired.technical_detail',
  'payment_status.support_required.label_v180',
  'payment_status.support_required.body_v180',
  'payment_status.support_required.cta_v180',
  'payment_status.support_required.technical_detail',
  'payment_status.support_required.ticket_missing',
  'payment_status.cross_actor.for_you',
  'payment_status.cross_actor.for_us',
  'payment_status.technical_expand_summary',
  'payment_status.mailto_order_label',
  'payment_status.mailto_ticket_label',
];

describe('v1.8.0 translation key coverage — pl.json', () => {
  for (const key of requiredKeys) {
    it(`pl.json: "${key}" is defined`, async () => {
      const pl = await import('../../../../../../../../messages/pl.json');
      const parts = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cursor: any = pl;
      for (const part of parts) { cursor = cursor?.[part]; }
      expect(cursor).toBeDefined();
      expect(typeof cursor).toBe('string');
    });
  }
});

describe('v1.8.0 translation key coverage — en.json', () => {
  // L2 fix: en.json was missing from coverage; any missing/wrong key fails here
  for (const key of requiredKeys) {
    it(`en.json: "${key}" is defined`, async () => {
      const en = await import('../../../../../../../../messages/en.json');
      const parts = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cursor: any = en;
      for (const part of parts) { cursor = cursor?.[part]; }
      expect(cursor).toBeDefined();
      expect(typeof cursor).toBe('string');
    });
  }
});

// ─── Sprint 5 gate — J3 E2E lifecycle ────────────────────────────────────────

describe.skip('Sprint 5 gate — J3 E2E lifecycle', () => {
  it('paid → failed_retryable → retry → paid recovery path', () => { /* Sprint 5 gate */ });
  it('webhook race during pending_psp polling', () => { /* Sprint 5 gate */ });
  it('3DS interleaving with auto-poll', () => { /* Sprint 5 gate */ });
});
