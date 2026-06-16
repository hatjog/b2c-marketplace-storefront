import type { MessageCatalog, MessageNode } from './keyParity';

interface MessageFallbackInput {
  key: string;
  namespace?: string;
}

interface NextIntlErrorLike {
  code?: string;
  message?: string;
}

export interface RawKeyGuardOptions {
  fallbacks: MessageCatalog[];
  environment?: string;
  logger?: Pick<Console, 'error' | 'warn'>;
}

function fullMessageKey(namespace: string | undefined, key: string): string {
  if (namespace && key === namespace) return key;
  if (namespace && key.startsWith(`${namespace}.`)) return key;
  return namespace ? `${namespace}.${key}` : key;
}

function readNestedString(messages: MessageCatalog, dottedPath: string): string | null {
  let cursor: MessageNode = messages;

  for (const segment of dottedPath.split('.')) {
    if (cursor && typeof cursor === 'object' && !Array.isArray(cursor) && segment in cursor) {
      cursor = cursor[segment];
    } else {
      return null;
    }
  }

  return typeof cursor === 'string' ? cursor : null;
}

function isMissingMessageError(error: NextIntlErrorLike): boolean {
  return error.code === 'MISSING_MESSAGE' || /MISSING_MESSAGE|missing message/i.test(error.message ?? '');
}

function shouldFailLoud(environment: string | undefined): boolean {
  return environment !== 'production';
}

export function createRawKeyGuard(options: RawKeyGuardOptions) {
  const environment = options.environment ?? process.env.NODE_ENV;
  const logger = options.logger ?? console;

  function getMessageFallback({ key, namespace }: MessageFallbackInput): string {
    const fullKey = fullMessageKey(namespace, key);

    for (const messages of options.fallbacks) {
      const fallback = readNestedString(messages, fullKey);
      if (fallback && fallback !== fullKey && fallback !== key) {
        return fallback;
      }
    }

    const message = `[i18n] Missing message fallback for "${fullKey}"`;
    if (shouldFailLoud(environment)) {
      throw new Error(message);
    }

    logger.error(message);
    return '';
  }

  function onError(error: NextIntlErrorLike): void {
    if (isMissingMessageError(error) && shouldFailLoud(environment)) {
      throw new Error(`[i18n] ${error.message ?? error.code ?? 'Missing message'}`);
    }

    if (environment !== 'production') {
      logger.warn('[next-intl]', error.code, error.message);
    }
  }

  return {
    getMessageFallback,
    onError
  };
}
