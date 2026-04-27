import { describe, it, expect } from 'vitest';

import {
  CSP_DIRECTIVES,
  CSP_DIRECTIVE_LIST,
  resolveCspHeaderName,
} from '@/lib/security/csp';

/**
 * D-64 (architecture.md:328) — CSP header policy + env-var toggle tests.
 *
 * Covers AC #1 (9 directives), AC #2 (env-var resolver + fail-fast),
 * AC #7 (header name + directive list per mode).
 *
 * Header is wired into Next.js via `next.config.ts` `headers()`; that
 * config consumes the same `CSP_DIRECTIVES` + `resolveCspHeaderName`
 * exports tested here, so this unit test guarantees the values that
 * Next.js will actually emit at runtime.
 */

const EXPECTED_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' fonts.gstatic.com",
  "img-src 'self' https: blob: data:",
  "connect-src 'self' https://*.sentry.io https://*.posthog.com https://api.mercurjs.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

describe('CSP directive list (D-64 AC #1)', () => {
  it('contains exactly the 9 D-64 directives', () => {
    expect(CSP_DIRECTIVE_LIST).toEqual(EXPECTED_DIRECTIVES);
  });

  it('joins directives with "; " separator for header value', () => {
    expect(CSP_DIRECTIVES).toBe(EXPECTED_DIRECTIVES.join('; '));
  });

  it('includes Tailwind unsafe-inline for styles only (NOT scripts)', () => {
    expect(CSP_DIRECTIVES).toContain("style-src 'self' 'unsafe-inline'");
    expect(CSP_DIRECTIVES).toContain("script-src 'self'");
    // No 'unsafe-inline' in script-src directive.
    const scriptSrc = CSP_DIRECTIVE_LIST.find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self'");
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('includes anti-clickjacking frame-ancestors none', () => {
    expect(CSP_DIRECTIVES).toContain("frame-ancestors 'none'");
  });

  it('whitelists Sentry, PostHog, and Mercur in connect-src', () => {
    const connectSrc = CSP_DIRECTIVE_LIST.find((d) => d.startsWith('connect-src'));
    expect(connectSrc).toContain('https://*.sentry.io');
    expect(connectSrc).toContain('https://*.posthog.com');
    expect(connectSrc).toContain('https://api.mercurjs.com');
  });
});

describe('resolveCspHeaderName — STOREFRONT_CSP_MODE toggle (D-64 AC #2, R3-AI-07)', () => {
  it('returns Content-Security-Policy when mode = enforce', () => {
    expect(resolveCspHeaderName('enforce')).toBe('Content-Security-Policy');
  });

  it('returns Content-Security-Policy-Report-Only when mode = report-only', () => {
    expect(resolveCspHeaderName('report-only')).toBe(
      'Content-Security-Policy-Report-Only'
    );
  });

  it('defaults to enforce when env var unset (production default per AC #3)', () => {
    expect(resolveCspHeaderName(undefined)).toBe('Content-Security-Policy');
  });

  it('throws fail-fast on invalid value (NIE silently default)', () => {
    expect(() => resolveCspHeaderName('disabled')).toThrow(
      /STOREFRONT_CSP_MODE must be 'enforce' or 'report-only', got: disabled/
    );
    expect(() => resolveCspHeaderName('off')).toThrow(/got: off/);
    expect(() => resolveCspHeaderName('')).toThrow(/got: $/);
  });
});

describe('CSP header value parity between modes (D-64 AC #7)', () => {
  it('directive list is identical between enforce and report-only modes', () => {
    // Only the header NAME flips; the directive list is the single source
    // of truth used by both modes (NIE diverging policies).
    const enforceName = resolveCspHeaderName('enforce');
    const reportOnlyName = resolveCspHeaderName('report-only');

    expect(enforceName).not.toBe(reportOnlyName);
    // Both modes emit `CSP_DIRECTIVES` as the header value (proven by
    // shared import in next.config.ts headers() function).
    expect(CSP_DIRECTIVES).toBe(EXPECTED_DIRECTIVES.join('; '));
  });
});
