/**
 * Tests for lib/logger.ts structured logger wrapper.
 *
 * STAGING-FREE (AC5, UX-DR108/ADR-066): no Sentry DSN, no network, pure mock injection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @sentry/nextjs so logger tests never depend on Sentry vendor
vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { logger, type LogPayload } from '../logger';

describe('logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env to clean state
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('fallback (no Sentry DSN)', () => {
    it('logger.warn emits structured JSON to console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('test.event', { source: 'test-module', context: { flag: true } });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const arg = warnSpy.mock.calls[0]?.[0] as string;
      const parsed: LogPayload = JSON.parse(arg);
      expect(parsed.event_type).toBe('test.event');
      expect(parsed.source).toBe('test-module');
      expect(parsed.context).toEqual({ flag: true });
    });

    it('logger.error emits structured JSON to console.error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('test.error_event', { source: 'test-module', error_message: 'boom' });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const arg = errorSpy.mock.calls[0]?.[0] as string;
      const parsed: LogPayload = JSON.parse(arg);
      expect(parsed.event_type).toBe('test.error_event');
      expect(parsed.error_message).toBe('boom');
    });

    it('emitted payload includes event_type as first key (structured log convention)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('structured.check', { source: 'logger-test' });
      const parsed: LogPayload = JSON.parse(warnSpy.mock.calls[0]?.[0] as string);
      const keys = Object.keys(parsed);
      expect(keys[0]).toBe('event_type');
    });

    it('emitted payload does NOT contain PII-like raw URL fields at top level', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('homepage.image.fallback_used', {
        source: 'homepage-utils',
        context: { fallback_url_present: true, image_kind: 'null' },
      });
      const arg = warnSpy.mock.calls[0]?.[0] as string;
      // Ensure no raw URL string leaked in payload
      expect(arg).not.toMatch(/https?:\/\//);
      expect(arg).not.toMatch(/\/images\//);
    });
  });

  describe('Sentry path (DSN set)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://fake@sentry.io/123';
    });

    it('logger.warn calls Sentry.captureMessage with level warning', () => {
      logger.warn('test.sentry.warn', { source: 'test-module', context: { val: 1 } });

      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith('test.sentry.warn', {
        level: 'warning',
        extra: {
          event_type: 'test.sentry.warn',
          source: 'test-module',
          context: { val: 1 },
        },
      });
    });

    it('logger.error calls Sentry.captureMessage with level error', () => {
      logger.error('test.sentry.error', { source: 'test-module', error_message: 'bad' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith('test.sentry.error', {
        level: 'error',
        extra: {
          event_type: 'test.sentry.error',
          source: 'test-module',
          error_message: 'bad',
        },
      });
    });

    it('does NOT call console.warn when Sentry DSN is set', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('test.no.console', { source: 'x' });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('LogPayload type contract', () => {
    it('payload with only required fields is valid', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('minimal.event', { source: 'min-test' });
      const parsed: LogPayload = JSON.parse(warnSpy.mock.calls[0]?.[0] as string);
      expect(parsed).toHaveProperty('event_type');
      expect(parsed).toHaveProperty('source');
    });
  });
});
