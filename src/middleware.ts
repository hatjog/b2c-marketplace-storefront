import { NextResponse, type NextRequest } from 'next/server';

import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/routing';
import { PROTECTED_ROUTES } from './lib/constants';
import { resolveMarketLocales } from './lib/market-locales';
import { isTokenExpired } from './lib/helpers/token';
import { buildCspDirectiveListWithNonce, resolveCspHeaderName } from './lib/security/csp';

/**
 * v1.10.0 ra-1: emit a per-request nonce CSP. A static `script-src 'self'`
 * (the old `next.config.ts` `headers()` approach) blocks Next's own inline
 * hydration scripts under enforce mode → blank page. Setting the CSP (with a
 * fresh nonce) on the REQUEST headers makes Next stamp the same nonce on its
 * inline `<script>` tags; the matching RESPONSE header is what the browser
 * enforces. `STOREFRONT_CSP_MODE` still flips enforce ↔ report-only.
 */
function generateCspNonce(): string {
  return btoa(crypto.randomUUID());
}

const GP_LANG_COOKIE = '_gp_lang';
const GP_REGION_COOKIE = '_gp_region';

const VALID_REGION_RE = /^[a-z]{2}$/;
function isValidRegion(code: string): boolean {
  return VALID_REGION_RE.test(code);
}

function setPathnameResponseHeader(response: NextResponse, pathname: string) {
  response.headers.set('x-pathname', pathname);
  return response;
}

const makeAuthRedirect = (
  req: NextRequest,
  lang: string,
  reason: 'sessionRequired' | 'sessionExpired'
) => {
  const redirectUrl = new URL(`/${lang}/login`, req.url);
  redirectUrl.searchParams.set(reason, 'true');
  const response = NextResponse.redirect(redirectUrl);
  setPathnameResponseHeader(response, req.nextUrl.pathname);
  if (reason === 'sessionExpired') {
    response.cookies.delete('_medusa_jwt');
  }
  return response;
};

/**
 * Resolve language from URL segment, cookie, or default.
 * URL = language code (pl, en) — NOT country code.
 */
export function resolveLang(urlSegment: string, langCookie?: string): string {
  if (isSupportedLocale(urlSegment)) {
    return urlSegment;
  }
  if (langCookie && isSupportedLocale(langCookie)) {
    return langCookie;
  }
  return DEFAULT_LOCALE;
}

/**
 * Resolve region (country code) for Medusa from geo IP header or existing cookie.
 */
export function resolveRegion(geoCountry?: string, regionCookie?: string): string | undefined {
  if (regionCookie && isValidRegion(regionCookie)) return regionCookie;
  if (geoCountry) {
    const normalized = geoCountry.toLowerCase();
    if (isValidRegion(normalized)) return normalized;
  }
  return undefined;
}

// Story 3.2 + cleanup-19: 308 permanent redirect /[locale]/salony/* → /[locale]/sellers/* (SEO continuity, no redirect chain)
// allow: salony route preserved for 3.2 redirect source; 308 prevents 301→307 chain with locale-redirect branch
const SALONY_REDIRECT_RE = /^\/([a-z]{2})\/salony(\/.*)?$/;

export async function middleware(request: NextRequest) {
  // Short-circuit static assets (match common file extensions at end of path)
  if (/\.\w{2,5}$/.test(request.nextUrl.pathname)) {
    return setPathnameResponseHeader(NextResponse.next(), request.nextUrl.pathname);
  }

  const { pathname } = request.nextUrl;

  // Story 3.2: legacy /[locale]/salony/* → 308 → /[locale]/sellers/* (SEO permanent, method-preserving)
  // Inserted BEFORE resolveLang/auth-guard so redirect short-circuits locale processing.
  // Query params + handle suffix preserved 1:1 via request.nextUrl.search + capture group.
  // 308 (not 301) prevents redirect chain: if locale is not yet in SUPPORTED_LOCALES the
  // !isSupportedLocale branch would issue a second 307, causing a 301→307 chain. 308 preserves
  // method and avoids interaction with the locale-redirect branch for all 4 supported locales.
  const salonyMatch = pathname.match(SALONY_REDIRECT_RE);
  if (salonyMatch) {
    const [, locale, suffix = ''] = salonyMatch;
    const target = new URL(`/${locale}/sellers${suffix}`, request.url);
    target.search = request.nextUrl.search;
    return setPathnameResponseHeader(NextResponse.redirect(target, 308), pathname);
  }

  const urlSegment = pathname.split('/')[1] ?? '';
  const pathnameWithoutLang = isSupportedLocale(urlSegment)
    ? pathname.replace(/^\/[^/]+/, '')
    : pathname;

  const langCookieValue = request.cookies.get(GP_LANG_COOKIE)?.value;
  const lang = resolveLang(urlSegment, langCookieValue);

  // If URL segment is not a supported language, redirect to /{lang}{pathname}
  if (!isSupportedLocale(urlSegment)) {
    const redirectPath = pathname === '/' ? '' : pathname;
    const queryString = request.nextUrl.search ?? '';
    const redirectUrl = `${request.nextUrl.origin}/${lang}${redirectPath}${queryString}`;
    const response = NextResponse.redirect(redirectUrl, 307);
    setPathnameResponseHeader(response, pathname);
    response.cookies.set(GP_LANG_COOKIE, lang, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    return response;
  }

  // Story 1.1 v1.14.0 (AD-2): platform locale NOT supported by this market →
  // 307 to the market's `locales.default` with path + query preserved.
  // 307 (not 301/308) so a market `locales` change is never baked into browser
  // caches. The out-of-platform branch above (e.g. /fr → resolveLang) is
  // ratified legacy behavior and stays untouched.
  const marketLocales = await resolveMarketLocales();
  if (!(marketLocales.supported as readonly string[]).includes(urlSegment)) {
    const redirectUrl = new URL(
      pathname.replace(/^\/[^/]+/, `/${marketLocales.defaultLocale}`),
      request.url
    );
    redirectUrl.search = request.nextUrl.search;
    const response = NextResponse.redirect(redirectUrl, 307);
    setPathnameResponseHeader(response, pathname);
    response.cookies.set(GP_LANG_COOKIE, marketLocales.defaultLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    return response;
  }

  // Auth guard
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathnameWithoutLang.startsWith(route));
  if (isProtectedRoute) {
    const jwtCookie = request.cookies.get('_medusa_jwt');
    const token = jwtCookie?.value;
    if (!jwtCookie) {
      return makeAuthRedirect(request, lang, 'sessionRequired');
    }
    if (token && isTokenExpired(token)) {
      return makeAuthRedirect(request, lang, 'sessionExpired');
    }
  }

  const nonce = generateCspNonce();
  const cspValue = buildCspDirectiveListWithNonce(nonce).join('; ');
  const cspHeaderName = resolveCspHeaderName();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-gp-locale', lang);
  requestHeaders.set('x-pathname', pathname);
  // Next reads the nonce from the request CSP header and stamps it onto its
  // inline hydration scripts; x-nonce lets RSC/app code reuse the same nonce.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspValue);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  // Browser-enforced header (name flips enforce ↔ report-only via STOREFRONT_CSP_MODE).
  response.headers.set(cspHeaderName, cspValue);
  setPathnameResponseHeader(response, pathname);

  // Set _gp_lang cookie from URL lang
  if (langCookieValue !== lang) {
    response.cookies.set(GP_LANG_COOKIE, lang, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
  }

  // Set _gp_region cookie from geo IP if not already set
  const regionCookie = request.cookies.get(GP_REGION_COOKIE)?.value;
  if (!regionCookie) {
    const geoCountry = request.headers.get('x-vercel-ip-country')?.toLowerCase();
    const region = resolveRegion(geoCountry, undefined);
    if (region) {
      response.cookies.set(GP_REGION_COOKIE, region, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
      });
    }
  }

  return response;
}

export const config = {
  // Story 1.1 v1.14.0: Node.js middleware runtime (stable since Next 15.5) —
  // the market-aware locale resolver reads market.yaml through the fs-based
  // MarketRuntimeConfig loader, which the Edge runtime cannot bundle.
  runtime: 'nodejs',
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)'
  ]
};
