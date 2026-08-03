/**
 * Story v160-4-3 — radius helpers shared by the server data layer (page.tsx,
 * searchSellers) and the client-side `<RadiusSelector>` atom.
 *
 * Kept in a separate module (NOT inside `RadiusSelector.tsx`) because that
 * file is a `'use client'` boundary; importing exports from it on the server
 * triggers `Attempted to call clampRadius() from the server` runtime errors
 * in Next.js 15 App Router.
 */
export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

export const DEFAULT_RADIUS: RadiusOption = 10;

/**
 * Snap any numeric input to the nearest valid radius option, falling back
 * to the default when the input is missing or non-finite. Handles tampered
 * URLs (`?radius=999`) gracefully.
 */
export const clampRadius = (value: number | undefined | null): RadiusOption => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_RADIUS;
  let bestOption: RadiusOption = DEFAULT_RADIUS;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const option of RADIUS_OPTIONS) {
    const delta = Math.abs(option - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestOption = option;
    }
  }
  return bestOption;
};
