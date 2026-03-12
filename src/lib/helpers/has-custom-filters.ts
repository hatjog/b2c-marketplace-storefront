/**
 * Keys that trigger the custom pipeline endpoint /store/products/filtered.
 * Native Medusa keys (category_id, min_price, max_price) do NOT trigger pipeline alone.
 * When any CUSTOM_FILTER_KEY is active, ALL filters (including native ones) go through
 * the pipeline for consistent count/pagination.
 */
export const CUSTOM_FILTER_KEYS = [
  "tag_id",
  "city",
  "duration",
  "seller_rating",
] as const;

/**
 * Returns true if any custom (non-native Medusa) filter is active.
 *
 * IMPORTANT: Must be called on sanitized/parsed values — empty arrays from
 * sanitizeSearchParams (e.g. tag_id=,,, → []) correctly return false.
 */
export function hasCustomFilters({
  tagIds,
  cities,
  durations,
  sellerRatings,
}: {
  tagIds?: string[];
  cities?: string[];
  durations?: number[];
  sellerRatings?: number[];
}): boolean {
  return (
    (tagIds?.length ?? 0) > 0 ||
    (cities?.length ?? 0) > 0 ||
    (durations?.length ?? 0) > 0 ||
    (sellerRatings?.length ?? 0) > 0
  );
}
