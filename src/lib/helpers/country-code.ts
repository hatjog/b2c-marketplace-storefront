import { cookies } from 'next/headers';

const GP_REGION_COOKIE = '_gp_region';

/**
 * Resolve Medusa country code from _gp_region cookie,
 * falling back to locale for backward compatibility.
 * ADR-046: region comes from cookie/geo, not URL language segment.
 */
export async function getCountryCode(locale: string): Promise<string> {
  const cookieStore = await cookies();
  const regionCookie = cookieStore.get(GP_REGION_COOKIE)?.value;
  return regionCookie || locale;
}
