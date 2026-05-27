export type Locale = 'pl-PL' | 'en-US' | 'uk-UA' | 'de-DE';

export interface GetLocalizedMetadataFieldOptions {
  source: Record<string, unknown>;
  path: string;
  locale: Locale;
  marketDefaultLocale: Locale;
  canonicalLocale?: Locale;
}

const DEFAULT_CANONICAL_LOCALE: Locale = 'pl-PL';
const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function resolveDotPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cursor, segment) => {
    if (
      !segment ||
      UNSAFE_PATH_SEGMENTS.has(segment) ||
      cursor === null ||
      typeof cursor !== 'object' ||
      !Object.hasOwn(cursor, segment)
    ) {
      return undefined;
    }

    return (cursor as Record<string, unknown>)[segment];
  }, source);
}

/**
 * Zwraca tekst editorial z already-parsed gp-config bundle dla ścieżki dot-path.
 * Fallback chain: locale żądania → domyślny locale marketu → kanoniczny `pl-PL`.
 *
 * @example
 * getLocalizedMetadataField({
 *   source,
 *   path: 'editorial.hero.title',
 *   locale: 'de-DE',
 *   marketDefaultLocale: 'en-US'
 * });
 *
 * @see specs/releases/v1.10.0/prd.md#FR-B.6
 */
export function getLocalizedMetadataField({
  source,
  path,
  locale,
  marketDefaultLocale,
  canonicalLocale
}: GetLocalizedMetadataFieldOptions): string {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error('gp-config: invalid path');
  }

  const segments = path.split('.');
  if (segments.some((segment) => segment.trim() === '')) {
    throw new Error('gp-config: invalid path');
  }

  const effectiveCanonical = canonicalLocale ?? DEFAULT_CANONICAL_LOCALE;
  const localizedValue = resolveDotPath(source, path);
  const fallbackLocales = Array.from(
    new Set([locale, marketDefaultLocale, effectiveCanonical])
  );

  if (typeof localizedValue === 'string') {
    return localizedValue;
  }

  if (localizedValue && typeof localizedValue === 'object') {
    for (const fallbackLocale of fallbackLocales) {
      if (
        Object.hasOwn(localizedValue, fallbackLocale) &&
        typeof (localizedValue as Record<string, unknown>)[fallbackLocale] === 'string'
      ) {
        return (localizedValue as Record<string, string>)[fallbackLocale];
      }
    }
  }

  throw new Error(`gp-config: missing key '${path}' for locales [${fallbackLocales.join(', ')}]`);
}
