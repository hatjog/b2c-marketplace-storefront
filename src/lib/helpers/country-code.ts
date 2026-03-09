import { cookies } from 'next/headers';

const GP_REGION_COOKIE = '_gp_region';

/** Map language locale to a sensible ISO 3166-1 alpha-2 country fallback. */
const LOCALE_TO_COUNTRY: Record<string, string> = {
  pl: 'pl',
  en: 'gb', // English → United Kingdom as default
};

/**
 * Resolve Medusa country code from _gp_region cookie,
 * falling back to a country derived from locale.
 * ADR-046: region comes from cookie/geo, not URL language segment.
 */
export async function getCountryCode(locale: string): Promise<string> {
  const cookieStore = await cookies();
  const regionCookie = cookieStore.get(GP_REGION_COOKIE)?.value;
  return regionCookie || (LOCALE_TO_COUNTRY[locale] ?? 'pl');
}
