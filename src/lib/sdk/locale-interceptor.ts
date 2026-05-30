type HeaderTuple = [string, string];

export const CANONICAL_LOCALES = ['pl-PL', 'en-US', 'uk-UA', 'de-DE'] as const;
export type CanonicalLocale = (typeof CANONICAL_LOCALES)[number];

const DEFAULT_CANONICAL_LOCALE: CanonicalLocale = 'pl-PL';

// `ua`/`ua-ua`/`ua_ua` to legacy route slug storefront (D-55); canonical
// Ukrainian BCP 47 to `uk-UA` per ADR-124. Aliasy normalizują wejście do
// canonical; nie kopiuj `ua-*` jako BCP 47 w nowym kodzie.
const LOCALE_ALIASES: Record<string, CanonicalLocale> = {
  pl: 'pl-PL',
  'pl-pl': 'pl-PL',
  pl_pl: 'pl-PL',
  en: 'en-US',
  'en-us': 'en-US',
  en_us: 'en-US',
  uk: 'uk-UA',
  ua: 'uk-UA',
  'uk-ua': 'uk-UA',
  uk_ua: 'uk-UA',
  'ua-ua': 'uk-UA',
  ua_ua: 'uk-UA',
  de: 'de-DE',
  'de-de': 'de-DE',
  de_de: 'de-DE'
};

const ROUTE_LOCALE_BY_CANONICAL: Record<CanonicalLocale, string> = {
  'pl-PL': 'pl',
  'en-US': 'en',
  'uk-UA': 'ua',
  'de-DE': 'de'
};

type HeaderInput = HeadersInit | Record<string, string | null | undefined> | undefined;

type FetchLikeOptions = Omit<RequestInit, 'body' | 'headers'> & {
  headers?: HeaderInput;
  query?: Record<string, unknown>;
  body?: unknown;
  next?: unknown;
};

type LocaleAwareSdk = {
  client?: {
    fetch?: (...args: any[]) => any;
  };
  query?: {
    graph?: (...args: any[]) => any;
  };
};

function isHeaderTupleArray(value: HeaderInput): value is HeaderTuple[] {
  return Array.isArray(value);
}

function readBrowserCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const cookie = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

export function normalizeToCanonicalLocale(locale: unknown): CanonicalLocale {
  if (typeof locale !== 'string') {
    return DEFAULT_CANONICAL_LOCALE;
  }

  return LOCALE_ALIASES[locale.trim().toLowerCase()] ?? DEFAULT_CANONICAL_LOCALE;
}

export async function resolveStorefrontLocale(): Promise<CanonicalLocale> {
  if (typeof window === 'undefined') {
    try {
      const { getLocale } = await import('next-intl/server');
      return normalizeToCanonicalLocale(await getLocale());
    } catch {
      return DEFAULT_CANONICAL_LOCALE;
    }
  }

  return normalizeToCanonicalLocale(
    document.documentElement.lang ||
      readBrowserCookie('NEXT_LOCALE') ||
      readBrowserCookie('_gp_lang') ||
      DEFAULT_CANONICAL_LOCALE
  );
}

export function headersToRecord(headers: HeaderInput): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (isHeaderTupleArray(headers)) {
    return Object.fromEntries(headers);
  }

  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

export async function withLocaleHeader(
  headers?: HeaderInput,
  locale?: CanonicalLocale
): Promise<Record<string, string>> {
  return {
    ...headersToRecord(headers),
    'x-medusa-locale': locale ?? (await resolveStorefrontLocale())
  };
}

export async function withMercurLocaleOptions<T extends Record<string, any> | undefined>(
  args?: T
): Promise<T & { fetchOptions: Record<string, any> }> {
  const fetchOptions = (args?.fetchOptions ?? {}) as Record<string, any>;

  return {
    ...(args ?? ({} as T)),
    fetchOptions: {
      ...fetchOptions,
      headers: await withLocaleHeader(fetchOptions.headers)
    }
  } as T & { fetchOptions: Record<string, any> };
}

export async function localeCacheTag(tag: string, locale?: CanonicalLocale): Promise<string> {
  return `${tag}-${locale ?? (await resolveStorefrontLocale())}`;
}

export async function localePath(path: string, locale?: CanonicalLocale): Promise<string> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const routeLocale = ROUTE_LOCALE_BY_CANONICAL[locale ?? (await resolveStorefrontLocale())];

  if (normalizedPath === '/') {
    return `/${routeLocale}`;
  }

  return `/${routeLocale}${normalizedPath}`;
}

export async function localeAwareFetch(
  input: string | URL | Request,
  init: RequestInit & { next?: unknown } = {}
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: await withLocaleHeader(init.headers)
  });
}

export function applyLocaleInterceptor<T>(
  sdk: T,
  resolveLocale: () => Promise<CanonicalLocale> = resolveStorefrontLocale
): T {
  const localeAwareSdk = sdk as LocaleAwareSdk;

  if (localeAwareSdk.client?.fetch) {
    const originalFetch = localeAwareSdk.client.fetch.bind(localeAwareSdk.client);
    localeAwareSdk.client.fetch = async (path: string, options: FetchLikeOptions = {}) => {
      const locale = await resolveLocale();
      return originalFetch(path, {
        ...options,
        headers: await withLocaleHeader(options.headers, locale)
      });
    };
  }

  if (localeAwareSdk.query?.graph) {
    const originalGraph = localeAwareSdk.query.graph.bind(localeAwareSdk.query);
    localeAwareSdk.query.graph = async (options: FetchLikeOptions) => {
      const locale = await resolveLocale();
      return originalGraph({
        ...options,
        headers: await withLocaleHeader(options.headers, locale)
      });
    };
  }

  return sdk;
}
