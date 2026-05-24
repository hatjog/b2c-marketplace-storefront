/**
 * hreflang helper — produces hreflang codes from storefront locale codes.
 *
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-03, CC-3 L7):
 *   - SUPPORTED_LOCALES = {pl, en, ua, de}.
 *   - `toHreflang(code)` produces region-coded BCP-47 (pl-PL, en-GB, uk-UA, de-DE)
 *     for use in HTML `<link rel="alternate" hreflang="...">` HEAD elements.
 *   - `toHreflangBare(code)` produces bare ISO 639-1 codes (pl, en, uk, de)
 *     for sitemap `<xhtml:link>` per Story 6.6 AC4 / Story 6.7 AC8.
 *
 *   The `ua` storefront locale maps to `uk` per BCP-47 (Ukrainian language code).
 *   Pruned dead-locale mappings (fr/es/it/nl/se/no/dk/cz/sk/pt/br/at/ch/cn/jp/...)
 *   per CC-3 L7 — these were never in SUPPORTED_LOCALES.
 */

import { SUPPORTED_LOCALES } from '@/i18n/routing';

const REGION_MAP: Record<string, string> = {
  pl: 'pl-PL',
  en: 'en-GB',
  ua: 'uk-UA',
  de: 'de-DE'
};

const BARE_MAP: Record<string, string> = {
  pl: 'pl',
  en: 'en',
  ua: 'uk',
  de: 'de'
};

export const toHreflang = (code: string): string => {
  return REGION_MAP[code] || code;
};

export const toHreflangBare = (code: string): string => {
  return BARE_MAP[code] || code;
};

/**
 * Returns true when `code` is a recognised storefront locale.
 */
export const isSupportedHreflangCode = (code: string): boolean => {
  return (SUPPORTED_LOCALES as readonly string[]).includes(code);
};
