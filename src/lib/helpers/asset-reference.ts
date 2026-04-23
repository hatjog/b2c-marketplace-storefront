import { safeDecodeURIComponent } from './decode-uri';

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHttpUrl(value: unknown): string | null {
  const candidate = normalizeNonEmptyString(value);
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : null;
  } catch {
    return null;
  }
}

function normalizeRelativePath(value: unknown): string | null {
  const candidate = normalizeNonEmptyString(value);
  if (!candidate || !candidate.startsWith('/')) {
    return null;
  }

  return candidate;
}

function normalizeRuntimeAssetPath(value: unknown): string | null {
  const candidate = normalizeNonEmptyString(value);
  if (!candidate) {
    return null;
  }

  const normalized = candidate.replaceAll('\\', '/').replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    return null;
  }

  return segments[0] === 'assets' ? segments.join('/') : ['assets', ...segments].join('/');
}

export function buildRuntimeAssetUrl(marketId: string, assetPath: string): string {
  const encodedPath = assetPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `/api/runtime-market-assets/${encodeURIComponent(marketId)}/${encodedPath}`;
}

export function resolveMarketAssetUrl(value: unknown, marketId: string): string | null {
  const runtimeAssetPath = normalizeRuntimeAssetPath(value);

  return (
    normalizeHttpUrl(value) ??
    normalizeRelativePath(value) ??
    (runtimeAssetPath && marketId ? buildRuntimeAssetUrl(marketId, runtimeAssetPath) : null)
  );
}

export const STOREFRONT_PLACEHOLDER_IMAGE_SRC = '/images/placeholder.svg';

export function resolveStorefrontImageSrc(
  value: unknown,
  marketId: string,
  fallback = STOREFRONT_PLACEHOLDER_IMAGE_SRC
): string {
  const candidate = normalizeNonEmptyString(value);

  if (!candidate) {
    return fallback;
  }

  const decodedCandidate = safeDecodeURIComponent(candidate);

  return resolveMarketAssetUrl(decodedCandidate, marketId) ?? fallback;
}