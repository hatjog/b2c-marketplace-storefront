/**
 * Category tile image resolution — the ONE category-image reader (AD-10).
 *
 * Normative fallback order (do not reorder):
 *   `gp.images[is_primary]` → `gp.images[0]` → `photo_url` → `gp.photo_url` →
 *   bundled handle image → placeholder.
 *
 * `metadata.gp.images` is the carrier materialized by the backend
 * `gp-config-sync-media` script (array of `{url, alt, is_primary}`, source
 * order preserved). Relative source refs (`assets/…`) are resolved at render
 * time through the same-origin `/api/runtime-market-assets/<marketId>/…`
 * route via `resolveMarketAssetUrl` — the same path product `photo_url`
 * already takes (see ADR-159).
 *
 * The reader is graceful and NEVER throws: any broken invariant (missing
 * metadata, non-array `gp.images`, element without `url`, multiple
 * `is_primary`) logs a warning and falls through to the next step.
 *
 * Historical constraint kept from the original `categoryImageSrc`: the
 * storefront ships a small set of bundled images at
 * `/images/categories/<handle>.png`; seeds set that convention path even for
 * handles with no bundled file, which 404s through `next/image`. Convention
 * paths are therefore trusted only when the handle is in the known set.
 */
import { resolveMarketAssetUrl } from '@/lib/helpers/asset-reference';
import { getMarketId } from '@/lib/helpers/market-filter';

export const CATEGORY_IMAGE_HANDLES = new Set<string>([
  'accessories',
  'boots',
  'sandals',
  'shirt',
  'sneakers',
  'sport'
]);

export const CATEGORY_IMAGE_PLACEHOLDER = '/images/placeholder.svg';

export interface CategoryImage {
  src: string;
  /** Alt carried by the chosen `gp.images` element; null when the chosen source has no alt of its own. */
  alt: string | null;
}

interface GpImageCandidate {
  url: string;
  alt: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function warn(handle: string, message: string): void {
  console.warn(`[category-images] ${handle}: ${message}`);
}

/**
 * Extracts ordered `gp.images` candidates: the single `is_primary` element
 * first (if exactly one), then the first valid element. Broken invariants log
 * and degrade instead of throwing.
 */
function gpImageCandidates(handle: string, gp: Record<string, unknown> | null): GpImageCandidate[] {
  if (!gp || gp.images === undefined || gp.images === null) {
    return [];
  }

  if (!Array.isArray(gp.images)) {
    warn(handle, 'metadata.gp.images is not an array — falling through');
    return [];
  }

  const valid: GpImageCandidate[] = [];
  const primaries: GpImageCandidate[] = [];
  for (const element of gp.images) {
    const record = asRecord(element);
    const url = nonEmptyString(record?.url);
    if (!record || !url) {
      warn(handle, 'metadata.gp.images element without usable url — skipped');
      continue;
    }

    const candidate: GpImageCandidate = {
      url,
      alt: typeof record.alt === 'string' ? record.alt : null
    };
    valid.push(candidate);
    if (record.is_primary === true) {
      primaries.push(candidate);
    }
  }

  if (primaries.length > 1) {
    // Broken invariant (ADR-159 expects exactly one primary): ignore the
    // primary step entirely and degrade to the `gp.images[0]` step.
    warn(handle, `multiple is_primary elements (${primaries.length}) — using gp.images[0]`);
    return valid.slice(0, 1);
  }

  // Strict AC2 order: exactly one candidate leaves this step — the
  // `is_primary` element when unique, otherwise `gp.images[0]`. A second
  // `gp.images` entry is deliberately NOT offered as a fallback here; if the
  // chosen candidate's url is unresolvable, resolution falls through to the
  // next normative step (`photo_url` → `gp.photo_url` → placeholder), not to
  // another `gp.images` element (see 3-1-F2).
  const chosen = primaries.length === 1 ? primaries[0] : valid[0];
  return chosen ? [chosen] : [];
}

/**
 * Resolves a raw url candidate to a `next/image`-safe src, or null when the
 * candidate must be rejected (unresolvable form, or an untrusted bundled
 * convention path).
 */
function resolveCandidateSrc(url: string, marketId: string): string | null {
  const resolved = resolveMarketAssetUrl(url, marketId);
  // Reject only the root-relative bundled convention path itself
  // (`/images/categories/<handle>.png`), not any resolved URL that merely
  // *contains* that segment (e.g. a legitimate
  // `/api/runtime-market-assets/<market>/assets/images/categories/...` ref
  // or an absolute CDN URL with that path component) — see 3-1-F3.
  if (!resolved || resolved.startsWith('/images/categories/')) {
    return null;
  }

  return resolved;
}

/**
 * THE reader: resolves the category tile image `{src, alt}` from category
 * metadata. Never throws; every failure path degrades toward the placeholder.
 */
export function resolveCategoryImage(
  handle: string,
  metadata: unknown,
  marketId: string = getMarketId()
): CategoryImage {
  try {
    const meta = asRecord(metadata);
    const gp = asRecord(meta?.gp);

    for (const candidate of gpImageCandidates(handle, gp)) {
      const src = resolveCandidateSrc(candidate.url, marketId);
      if (src) {
        return { src, alt: candidate.alt };
      }
      warn(handle, `unresolvable gp.images url '${candidate.url}' — falling through`);
    }

    for (const rawUrl of [meta?.photo_url, gp?.photo_url]) {
      const url = nonEmptyString(rawUrl);
      if (!url) {
        continue;
      }

      const src = resolveCandidateSrc(url, marketId);
      if (src) {
        return { src, alt: null };
      }
    }

    if (CATEGORY_IMAGE_HANDLES.has(handle)) {
      return { src: `/images/categories/${handle}.png`, alt: null };
    }

    return { src: CATEGORY_IMAGE_PLACEHOLDER, alt: null };
  } catch (error) {
    // Hard guarantee for AC2: a broken tile must never take the page down.
    console.warn(`[category-images] ${handle}: unexpected resolution error — placeholder`, error);
    return { src: CATEGORY_IMAGE_PLACEHOLDER, alt: null };
  }
}
