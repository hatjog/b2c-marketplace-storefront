import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/routing';
import { createRawKeyGuard } from './lib/i18n/rawKeyGuard';
import enMessages from '../messages/en.json';
import plMessages from '../messages/pl.json';

type MessageNode = string | { [key: string]: MessageNode };
type MessageDict = { [key: string]: MessageNode };

const PL_FALLBACK = plMessages as MessageDict;
const EN_FALLBACK = enMessages as MessageDict;
const rawKeyGuard = createRawKeyGuard({
  fallbacks: [EN_FALLBACK, PL_FALLBACK],
});

/**
 * v1.13.0 Story 4.3 (FR-A4 / HG-3):
 *   - Active locale → EN → PL fallback cascade.
 *   - Missing keys fail loud in dev/test and never render raw key paths in prod.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !isSupportedLocale(locale)) {
    locale = DEFAULT_LOCALE;
  }

  const messages = (await import(`../messages/${locale}.json`)).default as MessageDict;

  return {
    locale,
    messages,
    onError: rawKeyGuard.onError,
    getMessageFallback: rawKeyGuard.getMessageFallback
  };
});
