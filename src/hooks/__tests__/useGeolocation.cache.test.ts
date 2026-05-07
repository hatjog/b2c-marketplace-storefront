/**
 * Tests for TF-70: useGeolocation sessionStorage cache.
 * Covers: cache read/write/clear, TTL expiry, SSR-safety.
 * Story: v160-cleanup-32-mv-pdp-residuals AC1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  readGeoCache,
  writeGeoCache,
  clearGeoCache,
  GEO_CACHE_KEY
} from '../useGeolocation';

// ---- sessionStorage mock ----
const sessionStorageData = new Map<string, string>();
const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStorageData.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => sessionStorageData.set(key, value)),
  removeItem: vi.fn((key: string) => sessionStorageData.delete(key)),
  clear: vi.fn(() => sessionStorageData.clear()),
};

Object.defineProperty(globalThis, 'window', {
  value: { sessionStorage: sessionStorageMock },
  writable: true,
  configurable: true,
});

describe('useGeolocation — sessionStorage cache (TF-70)', () => {
  beforeEach(() => {
    sessionStorageData.clear();
    vi.clearAllMocks();
    // Reset env var
    delete process.env.NEXT_PUBLIC_GEO_CACHE_TTL_MS;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GEO_CACHE_TTL_MS;
  });

  describe('readGeoCache', () => {
    it('returns null when no entry in sessionStorage', () => {
      expect(readGeoCache()).toBeNull();
    });

    it('returns cached entry when valid and within TTL', () => {
      const entry = { ts: Date.now(), status: 'granted' as const, lat: 52.2, lng: 21.0 };
      writeGeoCache(entry);
      const result = readGeoCache();
      expect(result).not.toBeNull();
      expect(result?.status).toBe('granted');
      expect(result?.lat).toBe(52.2);
      expect(result?.lng).toBe(21.0);
    });

    it('returns null and clears storage when entry is expired', () => {
      // Set TTL to 100ms
      process.env.NEXT_PUBLIC_GEO_CACHE_TTL_MS = '100';
      const entry = { ts: Date.now() - 200, status: 'granted' as const, lat: 52.2, lng: 21.0 };
      sessionStorageData.set(GEO_CACHE_KEY, JSON.stringify(entry));

      const result = readGeoCache();
      expect(result).toBeNull();
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(GEO_CACHE_KEY);
    });

    it('returns null for malformed JSON in sessionStorage', () => {
      sessionStorageData.set(GEO_CACHE_KEY, 'not-json{{{');
      expect(readGeoCache()).toBeNull();
    });

    it('returns null for entry missing ts field', () => {
      sessionStorageData.set(GEO_CACHE_KEY, JSON.stringify({ status: 'granted', lat: 1, lng: 2 }));
      expect(readGeoCache()).toBeNull();
    });

    it('caches denied status (user denied once → no re-prompt in session)', () => {
      const entry = { ts: Date.now(), status: 'denied' as const, lat: null, lng: null };
      writeGeoCache(entry);
      const result = readGeoCache();
      expect(result?.status).toBe('denied');
      expect(result?.lat).toBeNull();
    });
  });

  describe('writeGeoCache', () => {
    it('persists entry to sessionStorage', () => {
      const entry = { ts: 1234567890, status: 'granted' as const, lat: 51.1, lng: 17.0 };
      writeGeoCache(entry);
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        GEO_CACHE_KEY,
        JSON.stringify(entry)
      );
    });
  });

  describe('clearGeoCache', () => {
    it('removes entry from sessionStorage', () => {
      const entry = { ts: Date.now(), status: 'granted' as const, lat: 52.2, lng: 21.0 };
      writeGeoCache(entry);
      clearGeoCache();
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(GEO_CACHE_KEY);
      // Verify cache is gone
      expect(readGeoCache()).toBeNull();
    });
  });

  describe('TTL env override', () => {
    it('uses custom TTL from NEXT_PUBLIC_GEO_CACHE_TTL_MS env var', () => {
      process.env.NEXT_PUBLIC_GEO_CACHE_TTL_MS = '1000';
      // Entry 500ms old — should be within 1000ms TTL
      const entry = { ts: Date.now() - 500, status: 'granted' as const, lat: 1, lng: 2 };
      writeGeoCache(entry);
      expect(readGeoCache()).not.toBeNull();
    });

    it('expires entry when older than custom TTL', () => {
      process.env.NEXT_PUBLIC_GEO_CACHE_TTL_MS = '1000';
      // Entry 1500ms old — should be expired
      const entry = { ts: Date.now() - 1500, status: 'granted' as const, lat: 1, lng: 2 };
      sessionStorageData.set(GEO_CACHE_KEY, JSON.stringify(entry));
      expect(readGeoCache()).toBeNull();
    });

    it('ignores invalid (non-positive) TTL and uses default', () => {
      process.env.NEXT_PUBLIC_GEO_CACHE_TTL_MS = '-100';
      // Entry very recent — should be in any valid TTL
      const entry = { ts: Date.now(), status: 'granted' as const, lat: 1, lng: 2 };
      writeGeoCache(entry);
      // Should return entry since default TTL is 24h and entry is fresh
      // But with -100 treated as invalid → default 24h → still fresh
      expect(readGeoCache()).not.toBeNull();
    });
  });

  describe('SSR safety', () => {
    it('readGeoCache returns null when window is undefined (SSR)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error intentional SSR simulation
      globalThis.window = undefined;
      try {
        expect(readGeoCache()).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('writeGeoCache is no-op when window is undefined (SSR)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error intentional SSR simulation
      globalThis.window = undefined;
      try {
        // Should not throw
        expect(() =>
          writeGeoCache({ ts: Date.now(), status: 'granted', lat: 1, lng: 2 })
        ).not.toThrow();
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('clearGeoCache is no-op when window is undefined (SSR)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error intentional SSR simulation
      globalThis.window = undefined;
      try {
        expect(() => clearGeoCache()).not.toThrow();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
