import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '@/i18n/routing';

type HeaderTuple = [string, string];

export const CANONICAL_LOCALES = ['pl-PL', 'en-US', 'uk-UA', 'de-DE'] as const;
export type CanonicalLocale = (typeof CANONICAL_LOCALES)[number];

/**
 * v1.14.0 Story 1.2 (AD-1) — granica Data Cache to ZAWSZE slug routingu
 * (`pl|en|ua|de`), nigdy BCP-47. Alias (NIE drugi SSOT) na `SupportedLocale`
 * z `src/i18n/routing.ts`; nazwa `StorefrontLocaleSlug` czyni intencję jawną
 * w sygnaturach warstwy danych i jest tym, czego pilnuje lint-gate
 * `gp/locale-cache-boundary`.
 */
export type StorefrontLocaleSlug = SupportedLocale;

const DEFAULT_CANONICAL_LOCALE: CanonicalLocale = 'pl-PL';

// `ua`/`ua-ua`/`ua_ua` to legacy route slug storefront (D-55); canonical
// Ukrainian BCP 47 to `uk-UA` per ADR-124. Aliasy normalizują wejście do
// canonical; nie kopiuj `ua-*` jako BCP 47 w nowym kodzie.
//
// R9 cross-reference (Story 8.5): mapowanie `ua → uk-UA` jest kanonicznie
// zdefiniowane w `lib/helpers/hreflang.ts` (STOREFRONT_LOCALE_MAP). Ta mapa
// normalizuje WSZYSTKIE formy aliasów (w tym `uk`, `uk-ua`, `ua-ua`, …) do
// canonical BCP-47 — cel różny od kanonicznego helpera (4 storefront-kody → BCP-47),
// więc importowanie helpera nie jest tu właściwe. Każda zmiana mapowania
// `ua ↔ uk-UA` MUSI być odzwierciedlona w obu miejscach równocześnie.
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

// v1.14.0 Story 1.2: typ zacieśniony z `string` do `StorefrontLocaleSlug` — to
// jest miejsce, w którym `CanonicalLocale` (BCP-47) i slug routingu są ze sobą
// pogodzone. TS wyłapie rozjazd, gdyby ktoś dodał canonical bez slugu (albo
// odwrotnie: `SUPPORTED_LOCALES` bez odpowiednika w `CANONICAL_LOCALES`).
const ROUTE_LOCALE_BY_CANONICAL: Record<CanonicalLocale, StorefrontLocaleSlug> = {
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

/**
 * v1.14.0 Story 1.2 (AD-1) — slug routingu → BCP-47. To JEDYNA droga konwersji
 * dostępna warstwie danych; mapa aliasów pozostaje w tym pliku (żadnej trzeciej
 * kopii `ua ↔ uk-UA`, patrz nota R9 przy `LOCALE_ALIASES`).
 *
 * Synchroniczna z premedytacją: wołana wewnątrz callbacku `unstable_cache`,
 * gdzie NIE MA kontekstu requestu (`headers()`/`cookies()`/`getLocale()`).
 */
export function canonicalFromSlug(locale: StorefrontLocaleSlug): CanonicalLocale {
  return LOCALE_ALIASES[locale];
}

/**
 * BCP-47 → slug routingu. Dopełnienie `canonicalFromSlug`; używane przy
 * przenoszeniu locale z auto-resolve (poza cache scope) na granicę cache.
 */
export function slugFromCanonical(locale: CanonicalLocale): StorefrontLocaleSlug {
  return ROUTE_LOCALE_BY_CANONICAL[locale];
}

/**
 * Zawęża `string` z parametru route'u (`params.locale`) do union type slugów.
 * Legalne WYŁĄCZNIE poza cache scope (route → argument wrappera). Wewnątrz
 * `unstable_cache` argument jest już typu `StorefrontLocaleSlug` i nie wolno
 * go „odzyskiwać” z kontekstu.
 */
export function toStorefrontLocaleSlug(value: string | undefined | null): StorefrontLocaleSlug {
  return typeof value === 'string' && isSupportedLocale(value) ? value : DEFAULT_LOCALE;
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
  const base = headersToRecord(headers);
  // v1.12.0 UA-loc: an explicit caller-provided `x-medusa-locale` wins over the
  // auto-resolved one. On dynamic detail routes (PDP, seller) `getLocale()` can
  // resolve to the default locale inside the data-fetch async continuation
  // (notably when warmed from generateMetadata), so callers that already know
  // the route locale set the header explicitly for deterministic localization.
  if (typeof base['x-medusa-locale'] === 'string' && base['x-medusa-locale']) {
    return base;
  }
  return {
    ...base,
    'x-medusa-locale': locale ?? (await resolveStorefrontLocale())
  };
}

/**
 * v1.14.0 Story 1.2 (AD-1, AC2) — wariant `withLocaleHeader` dla CACHE SCOPE.
 *
 * Różnice wobec `withLocaleHeader` i powód ich istnienia:
 *  1. **synchroniczny** — wewnątrz callbacku `unstable_cache` nie ma kontekstu
 *     requestu, więc jakikolwiek `await resolveStorefrontLocale()` byłby albo
 *     błędem runtime, albo (gorzej) cichym `pl-PL` dla wszystkich locale;
 *  2. **locale jest WYMAGANE** i typowane slugiem — pominięcie to błąd typu,
 *     a nie cichy default. To właśnie ta wymuszalność jest treścią AC2.
 *
 * Konwersja slug → BCP-47 zachodzi WYŁĄCZNIE tutaj (AC3).
 */
export function withLocaleHeaderForSlug(
  headers: HeaderInput,
  locale: StorefrontLocaleSlug
): Record<string, string> {
  const base = headersToRecord(headers);

  // Spójnie z `withLocaleHeader`: jawny nagłówek od wołającego wygrywa.
  if (typeof base['x-medusa-locale'] === 'string' && base['x-medusa-locale']) {
    return base;
  }

  return {
    ...base,
    'x-medusa-locale': canonicalFromSlug(locale)
  };
}

/**
 * v1.14.0 Story 1.2 — `withMercurLocaleOptions` dla cache scope: synchroniczny,
 * z wymaganym slugiem. Auto-resolve interceptora jest w cache scope ZAKAZANY.
 */
export function withMercurLocaleOptionsForSlug<T extends Record<string, any> | undefined>(
  args: T,
  locale: StorefrontLocaleSlug
): T & { fetchOptions: Record<string, any> } {
  const fetchOptions = (args?.fetchOptions ?? {}) as Record<string, any>;

  return {
    ...(args ?? ({} as T)),
    fetchOptions: {
      ...fetchOptions,
      headers: withLocaleHeaderForSlug(fetchOptions.headers, locale)
    }
  } as T & { fetchOptions: Record<string, any> };
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

/**
 * v1.14.0 Story 1.2 (AC3) — wariant `localeCacheTag` dla cache scope:
 * synchroniczny, z WYMAGANYM slugiem. Wynik jest bajtowo identyczny z
 * `localeCacheTag(tag, canonicalFromSlug(slug))`, więc NIE powstaje trzecia
 * konwencja nazewnictwa tagów — zastane call-site'y rewalidacji
 * (`localeCacheTag`, `getCacheTag`) dalej trafiają w te same tagi.
 */
export function localeCacheTagForSlug(tag: string, locale: StorefrontLocaleSlug): string {
  return `${tag}-${canonicalFromSlug(locale)}`;
}

export async function localeCacheTag(tag: string, locale?: CanonicalLocale): Promise<string> {
  return `${tag}-${locale ?? (await resolveStorefrontLocale())}`;
}

/**
 * v1.14.0 Story 1.2 — auto-resolve locale sprowadzony do slugu. Wolno wołać
 * WYŁĄCZNIE PRZED wejściem do `unstable_cache` (AD-1: „locale rozwiązane przed
 * wejściem do cache”), nigdy wewnątrz callbacku.
 */
export async function resolveStorefrontLocaleSlug(): Promise<StorefrontLocaleSlug> {
  return slugFromCanonical(await resolveStorefrontLocale());
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
