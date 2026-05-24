import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/routing';
import enMessages from '../messages/en.json';
import plMessages from '../messages/pl.json';

type MessageNode = string | { [key: string]: MessageNode };
type MessageDict = { [key: string]: MessageNode };

const PL_FALLBACK = plMessages as MessageDict;
const EN_FALLBACK = enMessages as MessageDict;

function readNestedKey(messages: MessageDict, namespace: string | undefined, key: string): string | null {
  const path: string[] = [];
  if (namespace) path.push(...namespace.split('.'));
  path.push(...key.split('.'));

  let cursor: MessageNode = messages;
  for (const segment of path) {
    if (cursor && typeof cursor === 'object' && segment in cursor) {
      cursor = (cursor as { [key: string]: MessageNode })[segment];
    } else {
      return null;
    }
  }
  return typeof cursor === 'string' ? cursor : null;
}

/**
 * v1.9.0 Wave F7 hardening (CC-3 M9 — message fallback cascade):
 *   - Active locale → EN → PL → raw key path.
 *   - Prevents next-intl rendering raw key paths visibly to users when a
 *     locale catalogue drops a key while another locale still has it.
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
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[next-intl]', error.code, error.message);
      }
    },
    getMessageFallback({ key, namespace }) {
      const fromEn = readNestedKey(EN_FALLBACK, namespace, key);
      if (fromEn) return fromEn;
      const fromPl = readNestedKey(PL_FALLBACK, namespace, key);
      if (fromPl) return fromPl;
      return namespace ? `${namespace}.${key}` : key;
    }
  };
});
