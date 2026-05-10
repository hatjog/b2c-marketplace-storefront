/**
 * Map a language code (URL segment) to a BCP-47 hreflang tag.
 * Since ADR-046, the URL segment represents language, not country.
 * Supported languages: pl, en, ua, de. Legacy country codes kept for backward compat.
 * Note: the URL locale `ua` maps to Ukrainian's BCP-47 language subtag `uk`.
 */
export const toHreflang = (code: string): string => {
  const map: Record<string, string> = {
    // Supported language codes (primary)
    pl: 'pl',
    en: 'en',
    ua: 'uk',
    uk: 'uk',
    de: 'de',
    // Legacy country codes (backward compat — same 'pl' code still works)
    us: 'en',
    gb: 'en',
    au: 'en',
    ca: 'en',
    ie: 'en',
    fr: 'fr',
    es: 'es',
    it: 'it',
    nl: 'nl',
    se: 'sv',
    no: 'nb',
    dk: 'da',
    cz: 'cs',
    sk: 'sk',
    pt: 'pt',
    br: 'pt',
    at: 'de',
    ch: 'de',
    cn: 'zh',
    jp: 'ja',
    kr: 'ko',
    tw: 'zh',
    hk: 'zh',
    sg: 'en',
    my: 'ms'
  };
  return map[code] ?? code;
};
