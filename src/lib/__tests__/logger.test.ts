/**
 * Tests for lib/logger.ts structured logger wrapper.
 *
 * STAGING-FREE (AC5, UX-DR108/ADR-066): no Sentry DSN, no network, pure mock injection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @sentry/nextjs so logger tests never depend on Sentry vendor.
// The module is dynamic-imported inside dispatch(); vitest hoists vi.mock
// and intercepts both static and dynamic imports.
const captureMessageMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureMessage: captureMessageMock,
}));

import { logger, type LogPayload } from '../logger';

// Helper: drain microtasks + macrotask so dynamic import().then(...) callback runs.
const flushMicrotasks = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

describe('logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    captureMessageMock.mockClear();
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

    it('does NOT call Sentry.captureMessage when DSN is unset (lock dispatch invariant)', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.warn('no.sentry.warn', { source: 'x' });
      logger.error('no.sentry.error', { source: 'x' });
      await flushMicrotasks();
      expect(captureMessageMock).not.toHaveBeenCalled();
    });

    it('sanitizes URLs out of error_message defensively', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('test.sanitize', {
        source: 'sanitize-test',
        error_message: 'fetch failed for https://api.example.com/secret?token=abc123',
      });
      const arg = errorSpy.mock.calls[0]?.[0] as string;
      expect(arg).not.toContain('api.example.com');
      expect(arg).not.toContain('token=abc123');
      expect(arg).toContain('[url]');
    });
  });

  describe('Sentry path (DSN set)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://fake@sentry.io/123';
    });

    it('logger.warn calls Sentry.captureMessage with level warning and contexts.gp_log', async () => {
      logger.warn('test.sentry.warn', { source: 'test-module', context: { val: 1 } });
      await flushMicrotasks();

      expect(captureMessageMock).toHaveBeenCalledTimes(1);
      expect(captureMessageMock).toHaveBeenCalledWith('test.sentry.warn', {
        level: 'warning',
        contexts: {
          gp_log: {
            event_type: 'test.sentry.warn',
            source: 'test-module',
            context: { val: 1 },
          },
        },
      });
    });

    it('logger.error calls Sentry.captureMessage with level error', async () => {
      logger.error('test.sentry.error', { source: 'test-module', error_message: 'bad' });
      await flushMicrotasks();

      expect(captureMessageMock).toHaveBeenCalledWith('test.sentry.error', {
        level: 'error',
        contexts: {
          gp_log: {
            event_type: 'test.sentry.error',
            source: 'test-module',
            error_message: 'bad',
          },
        },
      });
    });

    it('does NOT call console.warn when Sentry DSN is set', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('test.no.console', { source: 'x' });
      await flushMicrotasks();
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
