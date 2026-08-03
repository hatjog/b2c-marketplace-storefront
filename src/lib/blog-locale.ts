/**
 * Blog/CMS locale contract — QD-I18N-04 (SPEC-storefront-i18n-completeness CAP-4).
 *
 * Single narrowing point between the storefront route locale (`pl|en|ua|de`,
 * `SUPPORTED_LOCALES`) and the Payload localization enum (`pl|en|uk|de`,
 * `portal/payload.config.ts` → `localization.locales`). The `ua ↔ uk` alias is
 * resolved here and nowhere else, so the Payload request locale, the render
 * cache key and the fallback `lang` attribute can never drift apart.
 *
 * Deliberately pure (no `server-only`, no fs, no fetch): both the server-only
 * detail reader and the shared `@/lib/blog` module import it.
 */

import type { SupportedLocale } from '@/i18n/routing';

export type PayloadLocale = 'pl' | 'en' | 'uk' | 'de';

/** Canonical Payload locale for a storefront route locale (ADR-154 alias set). */
export function mapRouteLocaleToPayloadLocale(locale: SupportedLocale | string): PayloadLocale {
  if (locale === 'ua' || locale === 'uk') {
    return 'uk';
  }

  if (locale === 'pl' || locale === 'en' || locale === 'de') {
    return locale;
  }

  return 'pl';
}

/**
 * BCP-47 tag for the `lang` attribute of a fallback content fragment.
 * A fallback article rendered inside a `de` page must carry its own `lang`
 * (party review PR-2) — otherwise assistive tech and search engines read
 * Polish prose as German.
 */
const BCP47_BY_PAYLOAD_LOCALE: Record<PayloadLocale, string> = {
  pl: 'pl-PL',
  en: 'en',
  uk: 'uk-UA',
  de: 'de-DE'
};

export function payloadLocaleToBcp47(locale: PayloadLocale): string {
  return BCP47_BY_PAYLOAD_LOCALE[locale];
}

/**
 * Human-readable language name of the fallback locale, expressed in the UI
 * locale. Keeps the notice translated without a per-locale × per-locale key
 * matrix in `messages/*.json`.
 */
export function formatFallbackLanguageName(
  fallbackLocale: PayloadLocale,
  uiLocale: SupportedLocale | string
): string {
  const fallbackTag = payloadLocaleToBcp47(fallbackLocale);
  const uiTag = payloadLocaleToBcp47(mapRouteLocaleToPayloadLocale(uiLocale));

  try {
    const displayNames = new Intl.DisplayNames([uiTag], { type: 'language' });
    return displayNames.of(fallbackTag) ?? fallbackTag;
  } catch {
    return fallbackTag;
  }
}

/**
 * Cache-key fragment. Every localized Payload read must include the canonical
 * locale in its revalidation tag, otherwise a `pl` response services a later
 * `de` request (SPEC decision 5, risk "cache bleed").
 */
export function blogCacheTag(scope: string, locale: PayloadLocale): string {
  return `${scope}-${locale}`;
}
