/**
 * Typed accessor for `metadata.gp.*` — the GP namespace on Medusa entities.
 *
 * All Medusa entities (products, categories, collections, etc.) store GP-specific
 * data under `metadata.gp`. This helper centralises the cast so consumers do not
 * scatter `metadata?.gp as T | undefined` expressions across the codebase.
 *
 * Usage:
 *   const gp = getGpMetadata<GpProductMetadata>(product.metadata);
 *   const rank = getGpField<number>(product.metadata, 'sort_rank');
 */

/**
 * Returns `metadata.gp` cast to `T`, or `undefined` if metadata is absent or
 * the `gp` key is not present.
 *
 * No runtime validation is performed — the caller is responsible for providing
 * a type that matches the data written by the sync pipeline.
 */
export function getGpMetadata<T>(
  metadata: Record<string, unknown> | null | undefined
): T | undefined {
  return metadata?.gp as T | undefined;
}

/**
 * Returns a single field from `metadata.gp` cast to `T`, or `undefined`.
 *
 * Convenience shorthand for:
 *   getGpMetadata<Record<string, unknown>>(metadata)?.[field] as T | undefined
 */
export function getGpField<T>(
  metadata: Record<string, unknown> | null | undefined,
  field: string
): T | undefined {
  const gp = getGpMetadata<Record<string, unknown>>(metadata);
  return gp?.[field] as T | undefined;
}
