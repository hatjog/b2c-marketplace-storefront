/**
 * hreflang helper — produces hreflang codes from storefront locale codes.
 *
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-03, CC-3 L7):
 *   - SUPPORTED_LOCALES = {pl, en, ua, de}.
 *   - `toHreflang(code)` produces region-coded BCP-47 (pl-PL, en-US, uk-UA, de-DE)
 *     for use in HTML `<link rel="alternate" hreflang="...">` HEAD elements.
 *   - `toHreflangBare(code)` produces bare ISO 639-1 codes (pl, en, uk, de)
 *     for sitemap `<xhtml:link>` per Story 6.6 AC4 / Story 6.7 AC8.
 *
 *   The `ua` storefront locale maps to `uk` per BCP-47 (Ukrainian language code).
 *   Pruned dead-locale mappings (fr/es/it/nl/se/no/dk/cz/sk/pt/br/at/ch/cn/jp/...)
 *   per CC-3 L7 — these were never in SUPPORTED_LOCALES.
 */

// Canonical BCP47 mapping per D-122 (specs/releases/v1.10.0/architecture.md#D-122).
// `en: 'en-US'` (was `en-GB` pre-v1.10.0) — świadoma re-kanonikalizacja per
// architecture decision; UI formatery (Intl.DateTime/NumberFormat) z `en-GB`
// pozostają poza scope Story 2.3 (flag for follow-up 2.x — patrz review R-4).
export const STOREFRONT_LOCALE_MAP = {
  pl: {
    bcp47: 'pl-PL',
    bare: 'pl',
    legalMasterFileName: 'master.md'
  },
  en: {
    bcp47: 'en-US',
    bare: 'en',
    legalMasterFileName: 'master.en.md'
  },
  ua: {
    bcp47: 'uk-UA',
    bare: 'uk',
    legalMasterFileName: 'master.uk.md'
  },
  de: {
    bcp47: 'de-DE',
    bare: 'de',
    legalMasterFileName: 'master.de.md'
  }
} as const;

export type StorefrontLocaleCode = keyof typeof STOREFRONT_LOCALE_MAP;

const getLocaleMapping = (code: string) => {
  return STOREFRONT_LOCALE_MAP[code as StorefrontLocaleCode];
};

export const toHreflang = (code: string): string => {
  return getLocaleMapping(code)?.bcp47 || code;
};

export const toIntlLocale = (code: string): string => {
  return getLocaleMapping(code)?.bcp47 ?? STOREFRONT_LOCALE_MAP.pl.bcp47;
};

export const toHreflangBare = (code: string): string => {
  return getLocaleMapping(code)?.bare || code;
};

export const toLegalMasterFileName = (code: StorefrontLocaleCode): string => {
  // Runtime guard: defensively handle values cast to StorefrontLocaleCode from
  // unvalidated input (route params, market.yaml). Unknown codes fall back to
  // the PL-default master file, consistent with fetchLegalDocument's locale_fallback.
  return STOREFRONT_LOCALE_MAP[code]?.legalMasterFileName ?? 'master.md';
};

export const toLegalTemplateLocale = (code: StorefrontLocaleCode): string => {
  // Runtime guard: unknown codes fall back to 'pl-PL' (PL default), consistent
  // with the behaviour of toHreflang (which passes unknown codes through unchanged
  // but this function is expected to return a valid BCP-47 tag).
  return STOREFRONT_LOCALE_MAP[code]?.bcp47 ?? 'pl-PL';
};

/**
 * Returns true when `code` is a recognised storefront locale.
 */
export const isSupportedHreflangCode = (code: string): boolean => {
  return code in STOREFRONT_LOCALE_MAP;
};
