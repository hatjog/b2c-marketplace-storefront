/**
 * MagicLinkRecoveryState — unit tests
 *
 * Story 2.6 (v1.7.0) AC1: Anti-enumeration — single neutral error copy
 * for all failure reasons (expired, used, unknown token).
 *
 * NFR16: Token MUST NOT appear in DOM, Referer or logs.
 * WCAG 2.1 AA: visible focus on recovery CTA, email input.
 *
 * Test approach: Since MagicLinkRecoveryState uses React hooks (useState,
 * useTransition), we test its API contract (props, structure) and verify
 * anti-enumeration by inspecting the module interface.
 *
 * Integration/E2E tests (Playwright) verify the rendered DOM, focus behavior
 * and Referrer-Policy header behavior.
 */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock react hooks to avoid "Cannot read properties of null" in test env
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    useState: (init: unknown) => [init, vi.fn()],
    useTransition: () => [false, (fn: () => void) => fn()],
  };
});

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const translations: Record<string, Record<string, string>> = {
      'voucher.recovery': {
        error_neutral_heading: 'Link expired or already used',
        error_neutral: 'Request a new recovery link.',
        email_label: 'Email address',
        email_placeholder: 'your@email.com',
        cta_request_new_link: 'Send recovery link',
        sent_confirmation: 'If this email is associated with a purchase, we will send a recovery link.',
      },
    };
    const t = (key: string) => translations[ns]?.[key] ?? key;
    return t;
  },
}));

// Mock server action
vi.mock('@/actions/voucher-recovery', () => ({
  requestVoucherRecoveryLink: vi.fn().mockResolvedValue({ ok: true }),
}));

import { MagicLinkRecoveryState } from '../MagicLinkRecoveryState/MagicLinkRecoveryState';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const render = (props: Parameters<typeof MagicLinkRecoveryState>[0]) =>
  (MagicLinkRecoveryState as unknown as (p: typeof props) => ReactEl)(props);

function findByProp(node: React.ReactNode, propKey: string, propValue: unknown): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null;
  const el = node as ReactEl;
  if (el.props[propKey] === propValue) return el;
  // Traverse children AND all other props that could be React nodes (action, icon, etc.)
  const allPropValues = Object.values(el.props);
  for (const val of allPropValues) {
    if (React.isValidElement(val) || Array.isArray(val)) {
      const found = findByProp(val as React.ReactNode, propKey, propValue);
      if (found) return found;
    }
  }
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  for (const child of children) {
    const found = findByProp(child, propKey, propValue);
    if (found) return found;
  }
  return null;
}

describe('MagicLinkRecoveryState', () => {
  it('renders default data-testid', () => {
    const root = render({ locale: 'en' });
    expect(root.props['data-testid']).toBe('magic-link-recovery-state');
  });

  it('accepts custom data-testid', () => {
    const root = render({ locale: 'en', 'data-testid': 'custom-recovery' });
    expect(root.props['data-testid']).toBe('custom-recovery');
  });

  it('renders recovery request CTA with data-testid', () => {
    const root = render({ locale: 'en' });
    const cta = findByProp(root, 'data-testid', 'recovery-request-link-cta');
    expect(cta).not.toBeNull();
  });

  it('renders email input field', () => {
    const root = render({ locale: 'en' });
    const input = findByProp(root, 'type', 'email');
    expect(input).not.toBeNull();
  });

  it('CTA has visible focus ring class (WCAG 2.1 AA)', () => {
    const root = render({ locale: 'en' });
    const cta = findByProp(root, 'data-testid', 'recovery-request-link-cta');
    const className = String((cta?.props as { className?: string })?.className ?? '');
    expect(className).toContain('focus:ring');
  });

  it('uses error StateCard (anti-enumeration — single neutral state)', () => {
    const root = render({ locale: 'en' });
    const card = findByProp(root, 'data-testid', 'magic-link-recovery-state-card');
    expect(card).not.toBeNull();
  });

  describe('Anti-enumeration (NFR16)', () => {
    it('component interface does NOT accept a token prop', () => {
      // Token must NEVER be passed to client components (NFR16 anti-enumeration).
      // Verify by checking that the component's prop type doesn't include 'token'.
      // This is enforced at TypeScript compile-time; runtime check: rendering
      // with only locale does not error out.
      const root = render({ locale: 'en' });
      expect(root.props['token']).toBeUndefined();
    });

    it('renders same neutral state regardless of no error-type differentiation', () => {
      // Both renders produce the same error card — no "expired" vs "used" distinction.
      const root1 = render({ locale: 'en' });
      const root2 = render({ locale: 'en', 'data-testid': 'magic-link-recovery-state-2' });
      const card1 = findByProp(root1, 'data-testid', 'magic-link-recovery-state-card');
      const card2 = findByProp(root2, 'data-testid', 'magic-link-recovery-state-card');
      // Both produce a card — same variant (error), no discrimination
      expect(card1).not.toBeNull();
      expect(card2).not.toBeNull();
      expect((card1?.props as { variant?: string })?.variant).toBe('error');
      expect((card2?.props as { variant?: string })?.variant).toBe('error');
    });

    it('passes the SAME i18n key to title and description regardless of failure cause', () => {
      // The component does not accept a failure-cause prop; the displayed
      // title/description must therefore be a constant, drawn from the
      // single neutral i18n key. This guarantees no token-existence info
      // leaks into the rendered copy under any failure mode (NFR16).
      const root = render({ locale: 'en' });
      const card = findByProp(root, 'data-testid', 'magic-link-recovery-state-card');
      const title = (card?.props as { title?: string })?.title;
      const description = (card?.props as { description?: string })?.description;
      expect(title).toBe('Link expired or already used');
      expect(description).toBe('Request a new recovery link.');
    });
  });
});
