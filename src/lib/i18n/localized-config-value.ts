/**
 * QD-01 — resolving locale-keyed market copy (SPEC-storefront-i18n-completeness).
 *
 * gp-ops market config stores every user-facing string as a locale map keyed by
 * the D-55 slugs (`pl` / `en` / `ua` / `de`). This module is the ONLY place that
 * turns such a map into a string. Two rules make that safe:
 *
 *  1. `locale` and `defaultLocale` are explicit arguments. Nothing here reads a
 *     request, a header or a module-level "current locale" — the effective locale
 *     set always arrives from the ADR-154 resolver (`src/lib/market-locales.ts`).
 *  2. An illegal shape throws. A map that silently degrades to an empty string is
 *     how "the mechanism exists but is dead on the real path" bugs are born, so
 *     the only tolerated non-map input is the legacy scalar migration shim, which
 *     warns loudly on every read.
 *
 * Fallback policy (decision 3 of the spec, ADR-154): route locale →
 * `market.locales.default`. There is no cross-locale chain beyond that, and a
 * fallback is always reported so the caller can label the fragment (`lang=` +
 * visible notice) instead of passing it off as a translation.
 */

import type { SupportedLocale } from '@/i18n/routing';

/** A locale-keyed copy map as authored in gp-ops. Not every key must be present. */
export type LocalizedConfigValue = Partial<Record<SupportedLocale, string>>;

export type ResolvedLocalizedValue = {
  /** The string to render. Never empty — a resolution that finds nothing returns null instead. */
  value: string;
  /** Which locale the string actually came from. */
  locale: SupportedLocale;
  /** True when `locale` differs from the requested locale. */
  isFallback: boolean;
  /** True when the source was still a pre-migration scalar. */
  fromLegacyScalar: boolean;
};

export type ResolveLocalizedValueOptions = {
  /** Requested (route) locale. */
  locale: SupportedLocale;
  /** `market.locales.default` — the single permitted fallback target. */
  defaultLocale: SupportedLocale;
  /** `market.locales.supported` — used to reject keys the market does not run. */
  supported: readonly SupportedLocale[];
  /** Dotted path used in errors and warnings, e.g. `sections.hero.heading`. */
  fieldPath: string;
};

const ERROR_PREFIX = '[localized-config]';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeEntry(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * True when `value` is shaped like a locale map. Deliberately structural: it does
 * NOT validate coverage — that is the authoring validator's job (gp-ops CLI +
 * validate_gp_runtime_config.py), which is the only layer that can fail an author.
 */
export function isLocalizedConfigValue(
  value: unknown,
  supported: readonly SupportedLocale[]
): value is LocalizedConfigValue {
  return isRecord(value) && Object.keys(value).some(key => (supported as readonly string[]).includes(key));
}

/**
 * Resolves one localized market-copy field.
 *
 * @returns the resolved value, or `null` when the field is absent/empty for both
 *   the requested locale and the market default (callers treat that as "no copy",
 *   exactly as they treated a missing scalar before the migration).
 * @throws when the value is present but structurally illegal — a non-string entry,
 *   an empty map, or a map whose keys are all outside the market's locale set.
 */
export function resolveLocalizedConfigValue(
  raw: unknown,
  options: ResolveLocalizedValueOptions
): ResolvedLocalizedValue | null {
  const { locale, defaultLocale, supported, fieldPath } = options;

  if (raw === undefined || raw === null) {
    return null;
  }

  // --- Migration shim: legacy scalar -------------------------------------
  // Read once, warn every time, and report it as a fallback whenever the route
  // locale is not the market default — a PL string on a /de route IS a fallback.
  // Removal criterion: this branch dies together with the last non-migrated
  // fixture/assembled output (SPEC PR-4), and its removal is covered by
  // localized-config-value.test.ts.
  if (typeof raw === 'string') {
    const value = normalizeEntry(raw);
    if (!value) {
      return null;
    }

    console.warn(
      `${ERROR_PREFIX} legacy scalar at ${fieldPath} — read as '${defaultLocale}'. ` +
        'Migrate the source to a locale map; the authoring validator already rejects scalars.'
    );

    return {
      value,
      locale: defaultLocale,
      isFallback: locale !== defaultLocale,
      fromLegacyScalar: true,
    };
  }

  if (!isRecord(raw)) {
    throw new Error(
      `${ERROR_PREFIX} ${fieldPath}: expected a locale map or a legacy string, got ${Array.isArray(raw) ? 'array' : typeof raw}`
    );
  }

  const keys = Object.keys(raw);
  if (keys.length === 0) {
    throw new Error(`${ERROR_PREFIX} ${fieldPath}: empty locale map`);
  }

  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && typeof raw[key] !== 'string') {
      throw new Error(
        `${ERROR_PREFIX} ${fieldPath}.${key}: locale entries must be strings, got ${typeof raw[key]}`
      );
    }
  }

  const usableKeys = keys.filter(key => (supported as readonly string[]).includes(key));
  if (usableKeys.length === 0) {
    throw new Error(
      `${ERROR_PREFIX} ${fieldPath}: locale map has no key from market.locales.supported [${supported.join(', ')}] (found: ${keys.join(', ')})`
    );
  }

  const requested = normalizeEntry(raw[locale]);
  if (requested) {
    return { value: requested, locale, isFallback: false, fromLegacyScalar: false };
  }

  const fallback = normalizeEntry(raw[defaultLocale]);
  if (fallback) {
    return {
      value: fallback,
      locale: defaultLocale,
      isFallback: locale !== defaultLocale,
      fromLegacyScalar: false,
    };
  }

  // Present, structurally legal, but empty for both the route locale and the
  // market default. Not an exception (the authoring validator owns coverage),
  // just "no copy" — the caller degrades exactly as with a missing field.
  return null;
}
