import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FlagDriftError,
  getCurrentFlagValue,
  snapshotFlagAtCartStart,
  verifyFlagUnchanged
} from './flagAtomicCheck';

/**
 * Story v160-5-9 AC1 + AC7 — unit coverage dla pure helpers.
 *
 * 4 minimalne testy per AC1:
 *   1. snapshot+match → no-throw (happy path)
 *   2. snapshot+drift on→off → throw FlagDriftError
 *   3. snapshot+drift off→on → throw FlagDriftError
 *   4. getCurrentFlagValue defaults to false gdy env unset
 *
 * Plus dodatkowe: FlagDriftError surface (expectedFlag/currentFlag/snapshotTs).
 */

describe('flagAtomicCheck', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getCurrentFlagValue', () => {
    it('returns false when NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED is unset', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', '');
      expect(getCurrentFlagValue()).toBe(false);
    });

    it('returns true when env value === "true"', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'true');
      expect(getCurrentFlagValue()).toBe(true);
    });

    it('returns false when env value is non-"true" string (e.g. "1")', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', '1');
      expect(getCurrentFlagValue()).toBe(false);
    });
  });

  describe('snapshotFlagAtCartStart', () => {
    it('captures current flag + ISO timestamp', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'true');
      const snapshot = snapshotFlagAtCartStart();
      expect(snapshot.flag).toBe(true);
      // ISO-8601 sanity check: parses do valid Date.
      expect(Number.isNaN(Date.parse(snapshot.ts))).toBe(false);
    });
  });

  describe('verifyFlagUnchanged', () => {
    it('does not throw when snapshot matches current flag (happy path)', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'true');
      const snapshot = { flag: true, ts: '2026-05-02T12:00:00.000Z' };
      expect(() => verifyFlagUnchanged(snapshot)).not.toThrow();
    });

    it('throws FlagDriftError when flag flipped on→off mid-session', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'false');
      const snapshot = { flag: true, ts: '2026-05-02T12:00:00.000Z' };
      expect(() => verifyFlagUnchanged(snapshot)).toThrow(FlagDriftError);
    });

    it('throws FlagDriftError when flag flipped off→on mid-session', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'true');
      const snapshot = { flag: false, ts: '2026-05-02T12:00:00.000Z' };
      expect(() => verifyFlagUnchanged(snapshot)).toThrow(FlagDriftError);
    });

    it('FlagDriftError carries expectedFlag/currentFlag/snapshotTs context', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'false');
      const snapshot = { flag: true, ts: '2026-05-02T12:00:00.000Z' };
      try {
        verifyFlagUnchanged(snapshot);
        // Unreachable.
        expect.fail('expected verifyFlagUnchanged to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(FlagDriftError);
        const drift = err as FlagDriftError;
        expect(drift.name).toBe('FlagDriftError');
        expect(drift.expectedFlag).toBe(true);
        expect(drift.currentFlag).toBe(false);
        expect(drift.snapshotTs).toBe('2026-05-02T12:00:00.000Z');
      }
    });
  });
});
