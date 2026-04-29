/**
 * Tag ID sanitizer for storefront URL search params (?tag_id=...).
 *
 * Accepts these formats (in priority order):
 *   1. UUID v4 (Mercur internal IDs)
 *   2. Plain alphanumeric (legacy v1.0–v1.2 IDs)
 *   3. Kebab-case (e.g. `k-beauty`, `naturalny`, `minimalistyczny`) —
 *      BonBeauty homepage StyleSection links require this branch
 *      (regression v1.4.0 deferred-work.md).
 *   4. Stable config ID `group:value` form (ADR-064).
 *
 * Defense-in-depth:
 *   - NFC normalization neutralizes visually-equivalent Unicode forms.
 *   - ASCII-only narrowing rejects fullwidth/combining-mark spoofs.
 *   - Length cap (64) prevents amplification attacks via crafted `tag_id=`.
 *
 * The exported regexes are also consumed inline by ProductListing's
 * sanitizeSearchParams to keep behavior in one place.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ALPHANUMERIC_RE = /^[a-z0-9]+$/i;
export const KEBAB_TAG_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const STABLE_TAG_ID_RE = /^[a-z0-9_-]+(?::[a-z0-9_-]+)+$/i;

export const TAG_ID_MAX_LEN = 64;

export function normalizeTagIdCandidate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const nfc = raw.normalize('NFC').trim();
  if (nfc.length === 0 || nfc.length > TAG_ID_MAX_LEN) return null;
  for (let i = 0; i < nfc.length; i++) {
    if (nfc.charCodeAt(i) > 0x7f) return null;
  }
  return nfc;
}

export function isValidTagId(candidate: string): boolean {
  return (
    UUID_RE.test(candidate) ||
    ALPHANUMERIC_RE.test(candidate) ||
    KEBAB_TAG_ID_RE.test(candidate) ||
    STABLE_TAG_ID_RE.test(candidate)
  );
}

export function sanitizeTagIdList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => normalizeTagIdCandidate(s))
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && isValidTagId(id));
}
