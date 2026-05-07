import { NextResponse, type NextRequest } from 'next/server';

import { PROTECTED_ROUTES } from './lib/constants';
import { isTokenExpired } from './lib/helpers/token';
import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/routing';

const GP_LANG_COOKIE = '_gp_lang';
const GP_REGION_COOKIE = '_gp_region';

const VALID_REGION_RE = /^[a-z]{2}$/;
function isValidRegion(code: string): boolean {
  return VALID_REGION_RE.test(code);
}

const makeAuthRedirect = (
  req: NextRequest,
  lang: string,
  reason: 'sessionRequired' | 'sessionExpired'
) => {
  const redirectUrl = new URL(`/${lang}/login`, req.url);
  redirectUrl.searchParams.set(reason, 'true');
  const response = NextResponse.redirect(redirectUrl);
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
    return NextResponse.next();
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
    return NextResponse.redirect(target, 308);
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
    response.cookies.set(GP_LANG_COOKIE, lang, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
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

  const response = NextResponse.next();

  // Set _gp_lang cookie from URL lang
  if (langCookieValue !== lang) {
    response.cookies.set(GP_LANG_COOKIE, lang, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  }

  // Set _gp_region cookie from geo IP if not already set
  const regionCookie = request.cookies.get(GP_REGION_COOKIE)?.value;
  if (!regionCookie) {
    const geoCountry = request.headers.get('x-vercel-ip-country')?.toLowerCase();
    const region = resolveRegion(geoCountry, undefined);
    if (region) {
      response.cookies.set(GP_REGION_COOKIE, region, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true });
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)'
  ]
};
