/**
 * Story v160-6-4: Voucher pause state helpers — pure utility for
 * client-side pause persistence.
 *
 * Strategy decision (T2.4): sessionStorage — tab-scoped, clears on tab close.
 * Matches "I need a moment, will decide soon" friction-gate UX.
 *
 * ePrivacy gate (v160-cleanup-34 / TF-80):
 *   Storage writes are gated on `requireCategory("preferences")` consent.
 *   Category: `preferences` — pause state is a UX preference, not strictly necessary.
 *   Reads remain ungated (read → false if nothing stored; safe degradation).
 *   On preferences revoke: keys cleared via clearPreferencesStorage() in consent module.
 *
 * Privacy invariant (AR45): stored value contains ONLY voucher `code` slug
 * (which is already public-facing as URL fragment). No buyer-side identifiers,
 * no recipient PII (no IP / no UA / no email).
 *
 * SSR-safe: all reads/writes guard on `typeof window !== 'undefined'` so
 * Server Component first render returns `false` and the React client
 * hydrates to actual storage value via useEffect.
 */

import { requireCategory } from '@/lib/consent';

const KEY_PREFIX = '_gp_voucher_paused';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

function storageKey(code: string): string {
  return `${KEY_PREFIX}:${code}`;
}

export function getPauseState(code: string): boolean {
  if (!isBrowser() || !code) return false;
  try {
    return sessionStorage.getItem(storageKey(code)) === '1';
  } catch {
    return false;
  }
}

export function setPauseState(code: string, paused: boolean): void {
  if (!isBrowser() || !code) return;
  // ePrivacy gate (TF-80): write only when preferences consent granted.
  // On false: silent no-op — pause UX gracefully degrades to session-volatile
  // React state (modal still opens; reload loses pause if consent absent).
  if (!requireCategory('preferences')) return;
  try {
    if (paused) {
      sessionStorage.setItem(storageKey(code), '1');
    } else {
      sessionStorage.removeItem(storageKey(code));
    }
  } catch {
    // Quota / privacy mode → silent no-op.
  }
}

export function clearPauseState(code: string): void {
  setPauseState(code, false);
}
