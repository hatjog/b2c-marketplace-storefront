const GP_REGION_COOKIE = '_gp_region';

/** Map language locale to a sensible ISO 3166-1 alpha-2 country fallback. */
const LOCALE_TO_COUNTRY: Record<string, string> = {
  pl: 'pl',
  en: 'gb', // English → United Kingdom as default
};

function parseRegionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName !== GP_REGION_COOKIE || rawValue.length === 0) {
      continue;
    }

    return rawValue.join('=').trim() || undefined;
  }

  return undefined;
}

function getClientRegionCookie(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return parseRegionCookie(document.cookie);
}

async function getServerRegionCookie(): Promise<string | undefined> {
  if (typeof window !== 'undefined') {
    return undefined;
  }

  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    return cookieStore.get(GP_REGION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

/**
 * Resolve Medusa country code from _gp_region cookie,
 * falling back to a country derived from locale.
 * ADR-046: region comes from cookie/geo, not URL language segment.
 */
export async function getCountryCode(locale: string): Promise<string> {
  const regionCookie = getClientRegionCookie() ?? (await getServerRegionCookie());
  return regionCookie || (LOCALE_TO_COUNTRY[locale] ?? 'pl');
}
