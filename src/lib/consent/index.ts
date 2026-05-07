/**
 * ePrivacy CMP consent runtime API — Story v160-cleanup-34.
 *
 * Provides:
 *   getConsent()           — parse _gp_consent_v1 cookie → ConsentState | null
 *   setConsent(cats)       — write _gp_consent_v1 cookie (365d, path=/, SameSite=Lax)
 *   requireCategory(cat)   — gate for storage write-paths (returns bool)
 *   revokeCategory(cat)    — revoke one category + clear associated storage
 *   clearConsentCookie()   — remove cookie (revoke-all)
 *
 * Cookie format (OQ-2): JSON { version, ts, analytics, preferences, marketing }
 * Name: _gp_consent_v1   Path: /   SameSite: Lax   HttpOnly: false (JS must read)
 * Secure: produced at v1.10.0 prod-flip; staging-free baseline omits Secure flag.
 *
 * SSR-safe: every function guards on `typeof document !== 'undefined'`.
 *
 * Non-negotiable (ePrivacy Art. 5(3) + GDPR Art. 6/7):
 *   non-essential storage MUST NOT be written before consent state cookie is
 *   read and the relevant category === true.
 */

import type { ConsentCategory, ConsentCookiePayload, ConsentState } from './types';

export type { ConsentCategory, ConsentCookiePayload, ConsentState };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONSENT_COOKIE_NAME = '_gp_consent_v1';
const CONSENT_COOKIE_VERSION = 1;
const COOKIE_TTL_DAYS = 365;
const PREF_SESSION_STORAGE_PREFIX = '_gp_voucher_paused';
const FSM_SESSION_STORAGE_PREFIX = 'gp.fsm.';
const GEO_DENIAL_SESSION_KEY = 'gp_geo_denial_ts';
const IDB_PREF_DB_NAME = 'gp-voucher-offline';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isClient(): boolean {
  return typeof document !== 'undefined';
}

function parseCookie(raw: string): ConsentCookiePayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentCookiePayload>;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.version === 'number' &&
      typeof parsed.ts === 'string' &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.preferences === 'boolean' &&
      typeof parsed.marketing === 'boolean'
    ) {
      return parsed as ConsentCookiePayload;
    }
    return null;
  } catch {
    return null;
  }
}

function readConsentCookie(): ConsentCookiePayload | null {
  if (!isClient()) return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  const encoded = match.slice(CONSENT_COOKIE_NAME.length + 1);
  try {
    return parseCookie(decodeURIComponent(encoded));
  } catch {
    return null;
  }
}

function buildCookieString(payload: ConsentCookiePayload, ttlDays: number): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + ttlDays);
  const value = encodeURIComponent(JSON.stringify(payload));
  // F4: auto-add Secure on HTTPS contexts. Dev (HTTP) omits the flag — browsers
  // reject Secure cookies over HTTP. v1.10.0 prod-flip is HTTPS-only by definition.
  const isSecure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const secureAttr = isSecure ? '; Secure' : '';
  return `${CONSENT_COOKIE_NAME}=${value}; Path=/; SameSite=Lax${secureAttr}; Expires=${expires.toUTCString()}`;
}

// F9: in-memory cache for parsed consent state. Invalidated by setConsent/clearConsentCookie.
let consentCache: { value: ConsentState | null; cookieSig: string } | null = null;

function currentCookieSig(): string {
  if (!isClient()) return '';
  // Cheap signature — full cookie value is small and bounded.
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`));
  return match ?? '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read and parse the consent cookie.
 * Returns null if cookie is absent or malformed (treat as "no consent given").
 */
export function getConsent(): ConsentState | null {
  // F9: serve from cache when cookie unchanged.
  const sig = currentCookieSig();
  if (consentCache && consentCache.cookieSig === sig) {
    return consentCache.value;
  }
  const payload = readConsentCookie();
  const value: ConsentState | null = !payload
    ? null
    : {
        version: 1,
        ts: payload.ts,
        categories: {
          necessary: true,
          preferences: payload.preferences,
          analytics: payload.analytics,
          marketing: payload.marketing
        }
      };
  consentCache = { value, cookieSig: sig };
  return value;
}

/**
 * Persist consent decision in _gp_consent_v1 cookie.
 * Refreshes TTL (365d). Always sets necessary=true.
 */
export function setConsent(categories: {
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}): void {
  if (!isClient()) return;
  const payload: ConsentCookiePayload = {
    version: CONSENT_COOKIE_VERSION,
    ts: new Date().toISOString(),
    preferences: categories.preferences,
    analytics: categories.analytics,
    marketing: categories.marketing
  };
  document.cookie = buildCookieString(payload, COOKIE_TTL_DAYS);
  // F9: invalidate cache.
  consentCache = null;
  // F2: defensive — if preferences is now false, clear any pre-existing
  // sessionStorage / IndexedDB writes that may pre-date the gate (legacy
  // upgrade scenario, multi-tab residue, dev test data).
  if (!categories.preferences) {
    clearPreferencesStorage();
  }
}

/**
 * Accept all non-necessary categories.
 */
export function acceptAll(): void {
  setConsent({ preferences: true, analytics: true, marketing: true });
}

/**
 * Reject all non-necessary categories.
 */
export function rejectAll(): void {
  setConsent({ preferences: false, analytics: false, marketing: false });
}

/**
 * Gate for storage write-paths.
 * - `necessary` is always true (no consent required).
 * - Other categories require `_gp_consent_v1` cookie with category === true.
 * - Returns false when cookie is absent or malformed.
 */
export function requireCategory(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  const state = getConsent();
  if (!state) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[CMP] requireCategory("${category}"): no consent cookie — storage write blocked.`
      );
    }
    return false;
  }
  const allowed = state.categories[category];
  if (!allowed && process.env.NODE_ENV === 'development') {
    console.warn(
      `[CMP] requireCategory("${category}"): category not consented — storage write blocked.`
    );
  }
  return allowed;
}

/**
 * Revoke a specific non-necessary category.
 * Updates the cookie and clears associated storage.
 */
export function revokeCategory(category: Exclude<ConsentCategory, 'necessary'>): void {
  const current = getConsent();
  const currentCats = current?.categories ?? {
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false
  };
  setConsent({
    preferences: category === 'preferences' ? false : currentCats.preferences,
    analytics: category === 'analytics' ? false : currentCats.analytics,
    marketing: category === 'marketing' ? false : currentCats.marketing
  });
  if (category === 'preferences') {
    clearPreferencesStorage();
  }
  // analytics/marketing: PostHog wire is wired-but-gated; no client-side clear needed
}

/**
 * Remove the consent cookie (full revocation / re-prompt).
 */
export function clearConsentCookie(): void {
  if (!isClient()) return;
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  // F9: invalidate cache.
  consentCache = null;
}

// ---------------------------------------------------------------------------
// Preferences storage clear (AC4 revoke + AC5 revoke)
// ---------------------------------------------------------------------------

/**
 * Clear all sessionStorage entries belonging to the preferences category:
 *   - _gp_voucher_paused:* (Story 6.4)
 *   - gp.fsm.* (state machine snapshots — Story 6.4 pause state machine)
 *   - gp_geo_denial_ts (geo-denial cache — UX preference)
 *
 * Called when preferences consent is revoked.
 */
export function clearPreferencesStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(PREF_SESSION_STORAGE_PREFIX) ||
        key.startsWith(FSM_SESSION_STORAGE_PREFIX) ||
        key === GEO_DENIAL_SESSION_KEY
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (privacy mode) — silent no-op
  }
  // IDB clear: gp-voucher-offline (Story 6.7 — preferences category)
  clearIdbPreferencesDb().catch(() => {
    // Non-fatal — tab may not have active IDB connection
  });
}

/**
 * Clear the IndexedDB voucher-offline database.
 * Used on preferences revoke (AC5).
 * Closes open connections first to avoid blocked delete.
 */
export async function clearIdbPreferencesDb(): Promise<void> {
  if (typeof globalThis === 'undefined' || typeof globalThis.indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase(IDB_PREF_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve(); // Non-fatal
    req.onblocked = () => {
      // DB is still open in another tab — resolve anyway; next open will get empty DB
      resolve();
    };
  });
}
