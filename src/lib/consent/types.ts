/**
 * ePrivacy CMP consent types — Story v160-cleanup-34.
 *
 * OQ-2 resolution: JSON-encoded `_gp_consent_v1` cookie.
 * OQ-4 resolution: necessary scope = session cookies, _gp_lang, _gp_consent_v1, CSRF tokens.
 */

export type ConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing';

export interface ConsentCategories {
  /** Always true — lawful basis: legitimate interest (auth, locale, consent tracking). */
  necessary: true;
  /** UX preference persistence (pause state, wizard state, geo-cache). Requires consent. */
  preferences: boolean;
  /** Analytics/telemetry (PostHog). Requires consent. */
  analytics: boolean;
  /** Marketing cookies. Requires consent. */
  marketing: boolean;
}

export interface ConsentState {
  /** Schema version — always 1 in v1.6.0; v2 gets a new cookie name. */
  version: 1;
  /** ISO timestamp of last consent decision. */
  ts: string;
  categories: ConsentCategories;
}

/** Encoded payload stored in `_gp_consent_v1` cookie. */
export interface ConsentCookiePayload {
  version: number;
  ts: string;
  analytics: boolean;
  preferences: boolean;
  marketing: boolean;
}
