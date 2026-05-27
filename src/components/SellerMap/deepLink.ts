export interface BuildMapDeepLinkOptions {
  lat: number;
  lng: number;
  name?: string;
  userAgent: string;
}

export interface MapDeepLink {
  primary: string;
  fallback: string;
  provider: 'apple' | 'google' | 'android' | 'web';
  labelKey: 'openAppleMaps' | 'openGoogleMaps';
}

function encodeLatLng(lat: number, lng: number): string {
  return encodeURIComponent(`${lat},${lng}`);
}

function encodeAndroidQuery(lat: number, lng: number, name?: string): string {
  const coords = `${lat},${lng}`;
  const label = name ? `(${name})` : '';
  return encodeURIComponent(`${coords}${label}`);
}

export function buildMapDeepLink({
  lat,
  lng,
  name,
  userAgent
}: BuildMapDeepLinkOptions): MapDeepLink {
  const ua = userAgent.toLowerCase();
  const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeLatLng(lat, lng)}`;

  if (/\b(iphone|ipad|ipod)\b/.test(ua)) {
    return {
      primary: `maps://?q=${encodeLatLng(lat, lng)}`,
      fallback,
      provider: 'apple',
      labelKey: 'openAppleMaps'
    };
  }

  if (/\bandroid\b/.test(ua)) {
    return {
      primary: `geo:${lat},${lng}?q=${encodeAndroidQuery(lat, lng, name)}`,
      fallback,
      provider: 'android',
      labelKey: 'openGoogleMaps'
    };
  }

  return {
    primary: fallback,
    fallback,
    provider: 'web',
    labelKey: 'openGoogleMaps'
  };
}
