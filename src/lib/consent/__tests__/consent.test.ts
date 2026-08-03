/**
 * AC6 — consent module tests.
 *
 * @vitest-environment jsdom
 *
 * Covers:
 *   (a) persistence: write cookie → re-read → state preserved
 *   (b) gating without cookie: requireCategory("preferences") → false
 *   (c) gating after accept-all: requireCategory("preferences") → true
 *   (d) revoke: accept → revoke → sessionStorage keys cleared
 *   (e) schema validation: malformed cookie → null (no consent)
 *   (f) necessary category always-on
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_COOKIE_NAME,
  acceptAll,
  clearConsentCookie,
  clearPreferencesStorage,
  getConsent,
  rejectAll,
  requireCategory,
  revokeCategory,
  setConsent
} from '../index';

// ---------------------------------------------------------------------------
// Cookie simulation
//
// NOTE (F10): this mock handles a single cookie name=value pair per `set` call
// but does NOT preserve multi-cookie ordering, attribute round-tripping, or
// path/domain scoping. Sufficient for `_gp_consent_v1` round-trips in this
// suite; broader cookie behaviour should be tested via a dedicated harness
// (e.g. `tough-cookie`) if future scenarios need it.
// ---------------------------------------------------------------------------

let cookieStore: Record<string, string> = {};

function mockDocumentCookie() {
  // Simulate document.cookie getter/setter
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      return Object.entries(cookieStore)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    },
    set(cookieStr: string) {
      // Parse name=value pair
      const parts = cookieStr.split(';').map((p) => p.trim());
      const [namePair] = parts;
      if (!namePair) return;
      const eqIdx = namePair.indexOf('=');
      if (eqIdx === -1) return;
      const name = namePair.slice(0, eqIdx);
      const value = namePair.slice(eqIdx + 1);
      // Handle expiry deletion
      const expiresPart = parts.find((p) => p.toLowerCase().startsWith('expires='));
      if (expiresPart) {
        const expDate = new Date(expiresPart.slice('expires='.length));
        if (expDate.getTime() <= Date.now()) {
          delete cookieStore[name];
          return;
        }
      }
      cookieStore[name] = value;
    }
  });
}

// ---------------------------------------------------------------------------
// sessionStorage simulation
// ---------------------------------------------------------------------------

let sessionStorageStore: Record<string, string> = {};

const sessionStorageMock: Storage = {
  get length() {
    return Object.keys(sessionStorageStore).length;
  },
  key(index: number): string | null {
    return Object.keys(sessionStorageStore)[index] ?? null;
  },
  getItem(key: string): string | null {
    return sessionStorageStore[key] ?? null;
  },
  setItem(key: string, value: string): void {
    sessionStorageStore[key] = value;
  },
  removeItem(key: string): void {
    delete sessionStorageStore[key];
  },
  clear(): void {
    sessionStorageStore = {};
  }
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  cookieStore = {};
  sessionStorageStore = {};
  mockDocumentCookie();
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: sessionStorageMock
  });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getConsent / setConsent (AC6-a: persistence)', () => {
  it('returns null when no cookie exists', () => {
    expect(getConsent()).toBeNull();
  });

  it('persists and reads back consent state', () => {
    setConsent({ preferences: true, analytics: false, marketing: false });
    const state = getConsent();
    expect(state).not.toBeNull();
    expect(state?.version).toBe(1);
    expect(state?.categories.preferences).toBe(true);
    expect(state?.categories.analytics).toBe(false);
    expect(state?.categories.marketing).toBe(false);
    expect(state?.categories.necessary).toBe(true);
    expect(typeof state?.ts).toBe('string');
  });

  it('overwrites previous consent on second setConsent call', () => {
    setConsent({ preferences: true, analytics: true, marketing: true });
    setConsent({ preferences: false, analytics: false, marketing: false });
    const state = getConsent();
    expect(state?.categories.preferences).toBe(false);
    expect(state?.categories.analytics).toBe(false);
  });
});

describe('requireCategory (AC6-b: gating without consent)', () => {
  it('returns false for preferences when no cookie exists', () => {
    expect(requireCategory('preferences')).toBe(false);
  });

  it('returns false for analytics when no cookie exists', () => {
    expect(requireCategory('analytics')).toBe(false);
  });

  it('returns false for marketing when no cookie exists', () => {
    expect(requireCategory('marketing')).toBe(false);
  });
});

describe('requireCategory (AC6-c: gating after accept-all)', () => {
  it('returns true for preferences after acceptAll()', () => {
    acceptAll();
    expect(requireCategory('preferences')).toBe(true);
  });

  it('returns true for analytics after acceptAll()', () => {
    acceptAll();
    expect(requireCategory('analytics')).toBe(true);
  });

  it('returns true for marketing after acceptAll()', () => {
    acceptAll();
    expect(requireCategory('marketing')).toBe(true);
  });
});

describe('revokeCategory (AC6-d: revoke clears storage)', () => {
  it('clears sessionStorage preference keys on preferences revoke', () => {
    // Setup sessionStorage keys
    sessionStorageStore['_gp_voucher_paused:some-code'] = '1';
    sessionStorageStore['gp.fsm.voucher-pause'] = '{"state":"paused","history":[]}';
    sessionStorageStore['gp_geo_denial_ts'] = String(Date.now());
    sessionStorageStore['unrelated_key'] = 'keep-me';

    // Accept then revoke preferences
    acceptAll();
    revokeCategory('preferences');

    // Verify preference keys cleared
    expect(sessionStorageMock.getItem('_gp_voucher_paused:some-code')).toBeNull();
    expect(sessionStorageMock.getItem('gp.fsm.voucher-pause')).toBeNull();
    expect(sessionStorageMock.getItem('gp_geo_denial_ts')).toBeNull();
    // Unrelated keys preserved
    expect(sessionStorageMock.getItem('unrelated_key')).toBe('keep-me');
  });

  it('updates cookie with preferences=false after revoke', () => {
    acceptAll();
    revokeCategory('preferences');
    const state = getConsent();
    expect(state?.categories.preferences).toBe(false);
    // Other categories unchanged
    expect(state?.categories.analytics).toBe(true);
    expect(state?.categories.marketing).toBe(true);
  });
});

describe('schema validation (AC6-e: malformed cookie → no consent)', () => {
  it('returns null for garbled cookie value', () => {
    cookieStore[CONSENT_COOKIE_NAME] = encodeURIComponent('not-json-at-all');
    expect(getConsent()).toBeNull();
  });

  it('returns null for JSON missing required fields', () => {
    cookieStore[CONSENT_COOKIE_NAME] = encodeURIComponent(JSON.stringify({ version: 1 }));
    expect(getConsent()).toBeNull();
  });

  it('returns null for cookie with wrong types', () => {
    cookieStore[CONSENT_COOKIE_NAME] = encodeURIComponent(
      JSON.stringify({ version: 1, ts: '2026-01-01', analytics: 'yes', preferences: 1, marketing: 0 })
    );
    expect(getConsent()).toBeNull();
  });
});

describe('necessary category (AC6-f: always-on)', () => {
  it('requireCategory("necessary") returns true when no cookie exists', () => {
    expect(requireCategory('necessary')).toBe(true);
  });

  it('requireCategory("necessary") returns true after rejectAll()', () => {
    rejectAll();
    expect(requireCategory('necessary')).toBe(true);
  });

  it('necessary is true in ConsentState after rejectAll', () => {
    rejectAll();
    const state = getConsent();
    expect(state?.categories.necessary).toBe(true);
  });
});

describe('acceptAll / rejectAll helpers', () => {
  it('acceptAll sets all non-necessary categories to true', () => {
    acceptAll();
    const state = getConsent();
    expect(state?.categories.preferences).toBe(true);
    expect(state?.categories.analytics).toBe(true);
    expect(state?.categories.marketing).toBe(true);
  });

  it('rejectAll sets all non-necessary categories to false', () => {
    rejectAll();
    const state = getConsent();
    expect(state?.categories.preferences).toBe(false);
    expect(state?.categories.analytics).toBe(false);
    expect(state?.categories.marketing).toBe(false);
  });
});

describe('F2 — setConsent with preferences=false clears pre-existing storage', () => {
  it('clears sessionStorage preference keys when setConsent disables preferences', () => {
    sessionStorageStore['_gp_voucher_paused:legacy'] = '1';
    sessionStorageStore['gp.fsm.legacy'] = '{}';
    sessionStorageStore['gp_geo_denial_ts'] = '123';
    sessionStorageStore['unrelated'] = 'keep';
    setConsent({ preferences: false, analytics: false, marketing: false });
    expect(sessionStorageMock.getItem('_gp_voucher_paused:legacy')).toBeNull();
    expect(sessionStorageMock.getItem('gp.fsm.legacy')).toBeNull();
    expect(sessionStorageMock.getItem('gp_geo_denial_ts')).toBeNull();
    expect(sessionStorageMock.getItem('unrelated')).toBe('keep');
  });

  it('does NOT clear preferences storage when setConsent enables preferences', () => {
    sessionStorageStore['_gp_voucher_paused:keep'] = '1';
    setConsent({ preferences: true, analytics: false, marketing: false });
    // Existing key remains because preferences are now consented.
    expect(sessionStorageMock.getItem('_gp_voucher_paused:keep')).toBe('1');
  });
});

describe('clearConsentCookie', () => {
  it('removes the consent cookie', () => {
    setConsent({ preferences: true, analytics: true, marketing: true });
    expect(getConsent()).not.toBeNull();
    clearConsentCookie();
    expect(getConsent()).toBeNull();
  });
});

describe('clearPreferencesStorage', () => {
  it('clears _gp_voucher_paused:* and gp.fsm.* keys from sessionStorage', () => {
    sessionStorageStore['_gp_voucher_paused:abc'] = '1';
    sessionStorageStore['_gp_voucher_paused:xyz'] = '1';
    sessionStorageStore['gp.fsm.my-machine'] = '{}';
    sessionStorageStore['other_key'] = 'stays';

    clearPreferencesStorage();

    expect(sessionStorageMock.getItem('_gp_voucher_paused:abc')).toBeNull();
    expect(sessionStorageMock.getItem('_gp_voucher_paused:xyz')).toBeNull();
    expect(sessionStorageMock.getItem('gp.fsm.my-machine')).toBeNull();
    expect(sessionStorageMock.getItem('other_key')).toBe('stays');
  });
});
