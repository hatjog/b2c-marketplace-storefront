'use client';

import { useEffect } from 'react';

import { useLocale } from 'next-intl';

import { toHreflang } from '@/lib/helpers/hreflang';

/**
 * Dynamically sets the `lang` attribute on the `<html>` element.
 *
 * The root layout.tsx cannot access `params.locale` because it sits outside
 * the `[locale]` route segment, so it renders a static `lang="pl"` default.
 * This component corrects it on the client once the locale is known via
 * next-intl's `useLocale()` hook (provided by NextIntlClientProvider in
 * `[locale]/layout.tsx`).
 */
export function HtmlLangSetter() {
  const locale = useLocale();

  useEffect(() => {
    const htmlLang = toHreflang(locale);
    document.documentElement.lang = htmlLang;
  }, [locale]);

  return null;
}
