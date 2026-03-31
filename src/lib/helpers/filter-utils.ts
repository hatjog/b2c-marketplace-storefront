/**
 * Filters out options with zero matching products and hides the entire dimension
 * if fewer than `threshold` unique options remain after filtering.
 *
 * Safe fallback: options with `count === undefined` are preserved (not hidden).
 *
 * @param options - Array of filter options with optional `count` property
 * @param threshold - Minimum number of unique options required to show dimension (default: 3)
 * @returns Filtered array of options, or `null` if the dimension should be hidden entirely
 */
export function filterEmptyOptions<T extends { count?: number }>(
  options: T[],
  threshold = 3
): T[] | null {
  const nonEmpty = options.filter(opt => opt.count === undefined || opt.count > 0);
  if (nonEmpty.length < threshold) return null;
  return nonEmpty;
}
