import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/routing';

type MessageDict = Record<string, unknown>;

let plMessagesCache: MessageDict | null = null;
let enMessagesCache: MessageDict | null = null;

async function loadPlMessages(): Promise<MessageDict> {
  if (plMessagesCache) return plMessagesCache;
  plMessagesCache = (await import('../messages/pl.json')).default as MessageDict;
  return plMessagesCache;
}

async function loadEnMessages(): Promise<MessageDict> {
  if (enMessagesCache) return enMessagesCache;
  enMessagesCache = (await import('../messages/en.json')).default as MessageDict;
  return enMessagesCache;
}

function readNestedKey(messages: MessageDict, namespace: string | undefined, key: string): string | null {
  const path: string[] = [];
  if (namespace) path.push(...namespace.split('.'));
  path.push(...key.split('.'));

  let cursor: unknown = messages;
  for (const segment of path) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as object)) {
      cursor = (cursor as Record<string, unknown>)[segment];
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
 *   - PL/EN catalogues are dynamically imported lazily then cached.
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
    async getMessageFallback({ key, namespace }) {
      try {
        const enFallback = await loadEnMessages();
        const fromEn = readNestedKey(enFallback, namespace, key);
        if (fromEn) return fromEn;
        const plFallback = await loadPlMessages();
        const fromPl = readNestedKey(plFallback, namespace, key);
        if (fromPl) return fromPl;
      } catch {
        // fallthrough — render the dotted key path so devs see the gap.
      }
      return namespace ? `${namespace}.${key}` : key;
    }
  };
});
