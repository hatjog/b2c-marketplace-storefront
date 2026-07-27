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

/** Kształt `metadata.gp.content_bar[<slug>]` — kontrakt content-bar.v1.schema.json. */
export type ContentBarMeasurement = { words: number; bar: boolean };

/**
 * Story 1.4 v1.14.0 (AD-4, ADR-164) — odczyt sygnału quality-gate liczonego
 * w SYNC-TIME. JEDYNY punkt, w którym storefront interpretuje `content_bar`;
 * konsumenci (gate listingu, metadane SEO PDP) czytają wyłącznie stąd, żeby
 * nie powstało drugie miejsce oceny jakości.
 *
 * Zwraca `undefined` dla KAŻDEGO kształtu, który nie jest booleanem `bar` pod
 * wybranym slugiem — brak mapy, `null`, nie-obiekt, brak wpisu locale, `bar`
 * nie-boolean. Wywołujący traktuje `undefined` jak „encja jeszcze nie przeszła
 * przez sync z materializacją" i wybiera własną ścieżkę zastępczą (EE-1).
 * Nigdy nie rzuca: uszkodzony kształt metadanych nie może wywalić listingu.
 */
export function readContentBarFlag(
  metadata: Record<string, unknown> | null | undefined,
  slug: string
): boolean | undefined {
  const contentBar = getGpField<unknown>(metadata, 'content_bar');
  if (!contentBar || typeof contentBar !== 'object' || Array.isArray(contentBar)) {
    return undefined;
  }

  const measurement = (contentBar as Record<string, unknown>)[slug] as
    | Partial<ContentBarMeasurement>
    | undefined;
  if (!measurement || typeof measurement !== 'object' || Array.isArray(measurement)) {
    return undefined;
  }

  return typeof measurement.bar === 'boolean' ? measurement.bar : undefined;
}
