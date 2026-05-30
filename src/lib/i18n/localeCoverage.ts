// SSR locale catalog-coverage probe (FR-B.4 / Trust Invariant #7).
//
// Computes a REAL coverage ratio for a target locale by comparing the set of
// leaf (string) translation keys present in that locale's message catalogue
// against the default-locale (PL) keyset. PL is the canonical fallback locale,
// so its keyset defines "100% expected content". A target-locale key counts as
// covered only when it exists AND carries a non-empty translated string — an
// empty string is a real untranslated-content signal, not coverage.
//
// This replaces the former hardcoded `pageCoverage` placeholder in the locale
// layout: the value now reflects the actual fraction of translatable strings
// the target locale ships, so `LocaleFallbackNotice` can genuinely surface when
// a non-PL locale is materially behind PL.
//
// Scope note: this is a per-locale CATALOG coverage ratio (whole-bundle), not a
// per-page probe. It is a genuine signal — when a locale drops or blanks keys
// relative to PL the ratio drops below the notice threshold. A future
// per-route probe can refine this by intersecting the PL keyset with the keys a
// given page actually consumes; until then the catalog ratio is the honest
// signal available at SSR time.

import deMessages from '../../../messages/de.json';
import enMessages from '../../../messages/en.json';
import plMessages from '../../../messages/pl.json';
import uaMessages from '../../../messages/ua.json';

type MessageNode = string | number | boolean | { [key: string]: MessageNode };
type MessageDict = { [key: string]: MessageNode };

const CATALOGS: Record<string, MessageDict> = {
  pl: plMessages as MessageDict,
  en: enMessages as MessageDict,
  ua: uaMessages as MessageDict,
  de: deMessages as MessageDict
};

const DEFAULT_LOCALE = 'pl';

/**
 * Collect the dotted paths of every leaf (string) key in a catalogue.
 * Non-string leaves (numbers/booleans) are ignored — only translatable text
 * strings participate in the coverage signal.
 */
function collectStringKeys(node: MessageNode, prefix: string, acc: Set<string>): void {
  if (typeof node === 'string') {
    acc.add(prefix);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [segment, child] of Object.entries(node)) {
      collectStringKeys(child, prefix ? `${prefix}.${segment}` : segment, acc);
    }
  }
}

/** Resolve a dotted path to its leaf string value, or null when absent/non-string. */
function readStringAtPath(dict: MessageDict, path: string): string | null {
  let cursor: MessageNode = dict;
  for (const segment of path.split('.')) {
    if (cursor && typeof cursor === 'object' && !Array.isArray(cursor) && segment in cursor) {
      cursor = (cursor as { [key: string]: MessageNode })[segment];
    } else {
      return null;
    }
  }
  return typeof cursor === 'string' ? cursor : null;
}

/**
 * Real catalog-coverage ratio for `locale` against the PL keyset.
 *
 * @returns a value in [0, 1]. The default locale (PL) always returns 1
 *   (canonical fallback baseline). Unknown locales return 1 (no fallback notice
 *   for a locale we cannot probe). For non-PL locales the ratio is
 *   `coveredKeys / plKeyCount`, where a key is covered when the locale carries a
 *   non-empty string at that path.
 */
export function computeLocaleCoverage(locale: string): number {
  if (locale === DEFAULT_LOCALE) {
    return 1;
  }

  const target = CATALOGS[locale];
  if (!target) {
    return 1;
  }

  const plKeys = new Set<string>();
  collectStringKeys(CATALOGS[DEFAULT_LOCALE], '', plKeys);

  if (plKeys.size === 0) {
    return 1;
  }

  let covered = 0;
  for (const key of plKeys) {
    const value = readStringAtPath(target, key);
    if (value !== null && value.trim().length > 0) {
      covered += 1;
    }
  }

  return covered / plKeys.size;
}
