/**
 * Story v160-6-4: Voucher pause state helpers — pure utility for
 * client-side pause persistence.
 *
 * Strategy decision (T2.4): sessionStorage — tab-scoped, clears on tab close.
 * Matches "I need a moment, will decide soon" friction-gate UX. Privacy-
 * friendlier than cookie persistence (no cross-session client-side state;
 * no ePrivacy banner consideration). 24h cookie path remains future polish
 * if "leave + come back tomorrow" UX proves needed in QA.
 *
 * Privacy invariant (AR45): stored value contains ONLY voucher `code` slug
 * (which is already public-facing as URL fragment). No buyer-side identifiers,
 * no recipient PII (no IP / no UA / no email).
 *
 * SSR-safe: all reads/writes guard on `typeof window !== 'undefined'` so
 * Server Component first render returns `false` and the React client
 * hydrates to actual storage value via useEffect.
 */

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
  try {
    if (paused) {
      sessionStorage.setItem(storageKey(code), '1');
    } else {
      sessionStorage.removeItem(storageKey(code));
    }
  } catch {
    // Quota / privacy mode → silent no-op. Pause UX gracefully degrades to
    // session-volatile React state (modal still opens; reload loses pause).
  }
}

export function clearPauseState(code: string): void {
  setPauseState(code, false);
}
