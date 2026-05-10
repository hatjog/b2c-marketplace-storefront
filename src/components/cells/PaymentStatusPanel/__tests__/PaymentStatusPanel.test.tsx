/**
 * Tests for PaymentStatusPanel — v1.7.0 Story 2.4.
 *
 * Verifies:
 *   - All 5 payment status states render with correct data-payment-status attribute.
 *   - Exactly one primary CTA per status (FR8).
 *   - lastUpdate timestamp is shown when provided, absent when null.
 *   - data-payment-status attribute reflects resolved status ID.
 *   - Unknown/null/undefined status defaults to pending_psp_confirmation (anti-optimistic-paid).
 *   - role=status aria-live=polite on container.
 *   - Primary CTA has correct data-cta-kind per status.
 *   - Primary CTA button has min-h-11 class (44px touch target).
 *   - Primary CTA is disabled when isLoading=true.
 *   - Callback handlers are wired to the correct CTA.
 *
 * Uses React element tree traversal (no @testing-library/react required) —
 * consistent with MagicLinkRecoveryState.test.tsx / VoucherHistoryEmptyState.test.tsx.
 *
 * Note: next-intl translation is mocked — we only verify structure/a11y,
 * not the actual localized strings (those are validated by validate_i18n_parity).
 */

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock react hooks to avoid "Cannot read properties of null" in test env
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    useEffect: vi.fn(), // no-op: skip focus side-effect in static render
    useRef: () => ({ current: null }), // stub ref
  };
});

// Mock next-intl client hook
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, _params?: Record<string, unknown>) => key,
}));

// Mock @/lib/utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}));

import { PaymentStatusPanel } from '../PaymentStatusPanel';
import type { PaymentStatusPanelProps } from '../PaymentStatusPanel';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const renderPanel = (props: PaymentStatusPanelProps) =>
  (PaymentStatusPanel as unknown as (p: PaymentStatusPanelProps) => ReactEl)(props);

// ─── Traversal helpers ─────────────────────────────────────────────────────

function findAll(node: React.ReactNode, predicate: (el: ReactEl) => boolean): ReactEl[] {
  const results: ReactEl[] = [];
  if (!node || typeof node !== 'object') return results;

  if (React.isValidElement<Record<string, unknown>>(node)) {
    const el = node as ReactEl;
    if (predicate(el)) results.push(el);

    const { children, ...rest } = el.props;
    // traverse children
    const childNodes: React.ReactNode[] = Array.isArray(children)
      ? children
      : children !== undefined
        ? [children]
        : [];
    for (const child of childNodes) {
      results.push(...findAll(child, predicate));
    }
    // traverse other props that might be React nodes (action, icon, etc.)
    for (const val of Object.values(rest)) {
      if (React.isValidElement(val)) {
        results.push(...findAll(val as React.ReactNode, predicate));
      }
    }
  } else if (Array.isArray(node)) {
    for (const item of node) {
      results.push(...findAll(item, predicate));
    }
  }

  return results;
}

function findByTestId(node: React.ReactNode, testId: string): ReactEl | null {
  const results = findAll(node, el => el.props['data-testid'] === testId);
  return results[0] ?? null;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('PaymentStatusPanel', () => {
  // ─── Renders all 5 status states ─────────────────────────────────────────

  it('renders paid status with data-payment-status=paid', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('paid');
  });

  it('renders pending_psp_confirmation status', () => {
    const el = renderPanel({ status: 'pending_psp_confirmation', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('pending_psp_confirmation');
  });

  it('renders failed status', () => {
    const el = renderPanel({ status: 'failed', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('failed');
  });

  it('renders support_required status', () => {
    const el = renderPanel({ status: 'support_required', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('support_required');
  });

  it('renders expired status', () => {
    const el = renderPanel({ status: 'expired', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('expired');
  });

  // ─── Anti-optimistic-paid guard ───────────────────────────────────────────

  it('defaults null status to pending_psp_confirmation (anti-optimistic-paid)', () => {
    const el = renderPanel({ status: null, lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('pending_psp_confirmation');
    expect(el.props['data-payment-status']).not.toBe('paid');
  });

  it('defaults undefined status to pending_psp_confirmation', () => {
    const el = renderPanel({ status: undefined, lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('pending_psp_confirmation');
  });

  it('defaults unknown alias "processing" to pending_psp_confirmation', () => {
    const el = renderPanel({ status: 'processing', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-payment-status']).toBe('pending_psp_confirmation');
  });

  it('never shows paid for unknown/null/undefined input (anti-optimistic-paid)', () => {
    const unknownStatuses = [null, undefined, '', 'processing', 'held', 'done', 'random'];
    for (const s of unknownStatuses) {
      const el = renderPanel({ status: s as string | null | undefined, lastUpdate: '2024-01-15T10:00:00Z' });
      expect(el.props['data-payment-status']).not.toBe('paid');
    }
  });

  // ─── data-testid on container ─────────────────────────────────────────────

  it('container has data-testid=payment-status-panel', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['data-testid']).toBe('payment-status-panel');
  });

  // ─── Exactly one primary CTA per status (FR8) ─────────────────────────────

  it('has exactly one primary CTA for paid', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    const ctaEls = findAll(el, e => e.props['data-testid'] === 'payment-status-primary-cta');
    expect(ctaEls).toHaveLength(1);
  });

  it('has exactly one primary CTA for pending_psp_confirmation', () => {
    const el = renderPanel({ status: 'pending_psp_confirmation', lastUpdate: '2024-01-15T10:00:00Z' });
    const ctaEls = findAll(el, e => e.props['data-testid'] === 'payment-status-primary-cta');
    expect(ctaEls).toHaveLength(1);
  });

  it('has exactly one primary CTA for failed', () => {
    const el = renderPanel({ status: 'failed', lastUpdate: '2024-01-15T10:00:00Z' });
    const ctaEls = findAll(el, e => e.props['data-testid'] === 'payment-status-primary-cta');
    expect(ctaEls).toHaveLength(1);
  });

  it('has exactly one primary CTA for support_required', () => {
    const el = renderPanel({ status: 'support_required', lastUpdate: '2024-01-15T10:00:00Z' });
    const ctaEls = findAll(el, e => e.props['data-testid'] === 'payment-status-primary-cta');
    expect(ctaEls).toHaveLength(1);
  });

  it('has exactly one primary CTA for expired', () => {
    const el = renderPanel({ status: 'expired', lastUpdate: '2024-01-15T10:00:00Z' });
    const ctaEls = findAll(el, e => e.props['data-testid'] === 'payment-status-primary-cta');
    expect(ctaEls).toHaveLength(1);
  });

  // ─── CTA kinds per status ─────────────────────────────────────────────────

  it('paid has primary CTA with data-cta-kind=continue', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(cta?.props['data-cta-kind']).toBe('continue');
  });

  it('pending_psp_confirmation has primary CTA with data-cta-kind=refresh', () => {
    const el = renderPanel({ status: 'pending_psp_confirmation', lastUpdate: '2024-01-15T10:00:00Z' });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(cta?.props['data-cta-kind']).toBe('refresh');
  });

  it('failed has primary CTA with data-cta-kind=retry', () => {
    const el = renderPanel({ status: 'failed', lastUpdate: '2024-01-15T10:00:00Z' });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(cta?.props['data-cta-kind']).toBe('retry');
  });

  it('support_required has primary CTA with data-cta-kind=contact_support', () => {
    const el = renderPanel({ status: 'support_required', lastUpdate: '2024-01-15T10:00:00Z' });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(cta?.props['data-cta-kind']).toBe('contact_support');
  });

  it('expired has primary CTA with data-cta-kind=abandon', () => {
    const el = renderPanel({ status: 'expired', lastUpdate: '2024-01-15T10:00:00Z' });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(cta?.props['data-cta-kind']).toBe('abandon');
  });

  // ─── Timestamp display ────────────────────────────────────────────────────

  it('shows timestamp when lastUpdate is provided', () => {
    const el = renderPanel({ status: 'pending_psp_confirmation', lastUpdate: '2024-01-15T10:00:00Z' });
    const timestamp = findByTestId(el, 'payment-status-timestamp');
    expect(timestamp).not.toBeNull();
  });

  it('does not show timestamp section when lastUpdate is null', () => {
    const el = renderPanel({ status: 'pending_psp_confirmation', lastUpdate: null });
    const timestamp = findByTestId(el, 'payment-status-timestamp');
    expect(timestamp).toBeNull();
  });

  // ─── Accessibility ────────────────────────────────────────────────────────

  it('has role=status on container', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['role']).toBe('status');
  });

  it('has aria-live=polite on container', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    expect(el.props['aria-live']).toBe('polite');
  });

  it('primary CTA is a button element', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(cta?.type).toBe('button');
  });

  it('primary CTA has min-h-11 class for 44px touch target', () => {
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z' });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect((cta?.props['className'] as string) ?? '').toContain('min-h-11');
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  it('disables primary CTA when isLoading=true', () => {
    const el = renderPanel({
      status: 'pending_psp_confirmation',
      lastUpdate: '2024-01-15T10:00:00Z',
      isLoading: true,
    });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(cta?.props['disabled']).toBe(true);
  });

  it('primary CTA is NOT disabled when isLoading=false', () => {
    const el = renderPanel({
      status: 'pending_psp_confirmation',
      lastUpdate: '2024-01-15T10:00:00Z',
      isLoading: false,
    });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    // disabled should be false/undefined
    expect(cta?.props['disabled']).toBeFalsy();
  });

  // ─── CTA onClick handlers wired correctly ─────────────────────────────────

  it('primary CTA onClick is a function for paid state', () => {
    const onContinue = vi.fn();
    const el = renderPanel({ status: 'paid', lastUpdate: '2024-01-15T10:00:00Z', onContinue });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    expect(typeof cta?.props['onClick']).toBe('function');
    // Simulate click by calling the handler
    (cta?.props['onClick'] as () => void)?.();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('primary CTA onClick triggers onRefresh for pending state', () => {
    const onRefresh = vi.fn();
    const el = renderPanel({ status: 'pending_psp_confirmation', lastUpdate: '2024-01-15T10:00:00Z', onRefresh });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    (cta?.props['onClick'] as () => void)?.();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('primary CTA onClick triggers onRetry for failed state', () => {
    const onRetry = vi.fn();
    const el = renderPanel({ status: 'failed', lastUpdate: '2024-01-15T10:00:00Z', onRetry });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    (cta?.props['onClick'] as () => void)?.();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('primary CTA onClick triggers onContactSupport for support_required state', () => {
    const onContactSupport = vi.fn();
    const el = renderPanel({ status: 'support_required', lastUpdate: '2024-01-15T10:00:00Z', onContactSupport });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    (cta?.props['onClick'] as () => void)?.();
    expect(onContactSupport).toHaveBeenCalledTimes(1);
  });

  it('primary CTA onClick triggers onAbandon for expired state', () => {
    const onAbandon = vi.fn();
    const el = renderPanel({ status: 'expired', lastUpdate: '2024-01-15T10:00:00Z', onAbandon });
    const cta = findByTestId(el, 'payment-status-primary-cta');
    (cta?.props['onClick'] as () => void)?.();
    expect(onAbandon).toHaveBeenCalledTimes(1);
  });
});
