import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !isSupportedLocale(locale)) {
    locale = DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
