import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/routing';
import { toHreflang } from '@/lib/helpers/hreflang';

/**
 * QD-01 — fragment-scoped locale fallback wrapper (SPEC-storefront-i18n-completeness,
 * party review PR-2).
 *
 * When market/CMS copy has no variant for the route locale we render the
 * `market.locales.default` variant instead. That fragment must be honest:
 *
 *  - a visible notice, written in the ROUTE locale (chrome never falls back
 *    across locales), tells the reader this is not a translation;
 *  - `lang` marks the fallen-back content — but ONLY when the whole fragment
 *    fell back. With a partial fallback the fragment still holds correctly
 *    translated siblings, and stamping the fallback language over them would
 *    mislead assistive tech and hreflang just as badly as the untranslated copy
 *    this package removes. Verified live: a `/ua` banner missing only its CTA
 *    label keeps a Ukrainian heading, so the section is NOT `lang="pl-PL"`.
 *
 * Residual gap (named, not hidden): per-FIELD `lang` for the partial case needs
 * the blocks to accept markup instead of plain strings. That refactor belongs to
 * the shared chrome work in QD-02, not here. `data-locale-fallback-fields`
 * carries the exact paths so QD-07's semantic E2E can assert on them today.
 *
 * Deliberately distinct from `LocaleFallbackNotice`, which is a page-level,
 * coverage-driven, dismissible client banner.
 */
export async function LocaleFallbackFragment({
  locale,
  fallbackLocale,
  whole,
  fields,
  children
}: {
  /** Route locale — the language the notice itself is written in. */
  locale: SupportedLocale;
  /** Locale the enclosed content actually came from (`market.locales.default`). */
  fallbackLocale: SupportedLocale;
  /** True when every translatable field of the fragment fell back. */
  whole: boolean;
  /** Dotted paths of the fields that fell back. */
  fields: string[];
  children: React.ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: 'common' });
  const fallbackTag = toHreflang(fallbackLocale);

  return (
    <div
      data-locale-fallback={fallbackTag}
      data-locale-fallback-scope={whole ? 'whole' : 'partial'}
      data-locale-fallback-fields={fields.join(' ')}
    >
      <p
        role="status"
        className="mx-auto max-w-screen-xl px-4 py-2 text-sm text-secondary"
      >
        {t('locale_fallback_notice', { locale: fallbackTag })}
      </p>
      {whole ? <div lang={fallbackTag}>{children}</div> : children}
    </div>
  );
}
