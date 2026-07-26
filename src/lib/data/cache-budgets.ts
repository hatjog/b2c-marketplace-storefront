/**
 * v1.14.0 Story 1.2 (AC5 / AD-14 / NFR-10) — budżety TTL Data Cache warstwy danych.
 *
 * Wartości pochodzą wprost z AD-14 (`specs/releases/v1.14.0/architecture.md`):
 * katalog produktowy odświeża się częściej niż drzewo kategorii, które jest
 * quasi-statyczne. Trzymane jako nazwane stałe (a nie magic numbers rozsiane po
 * fetcherach), żeby zmiana progu była jedną edycją i żeby test mógł je asertować.
 *
 * ŚWIADOMIE ZAAKCEPTOWANA TTL-STALENESS (AD-14): po re-syncu treści storefront
 * serwuje stare dane do `revalidate` sekund. W tym release NIE MA webhooka
 * revalidate — to jest decyzja, nie przeoczenie. Nie „naprawiaj” tego
 * agresywnym `revalidatePath`/skróceniem TTL bez zmiany AD-14.
 *
 * UWAGA — to jest INNA warstwa niż page-level `export const revalidate` w
 * route'ach (ISR odpowiedzi HTML). Obie warstwy współistnieją; nie zrównuj ich.
 */

/** AD-14: fetchery produktowe (`listProducts`, PDP) — 300 s. */
export const PRODUCTS_CACHE_REVALIDATE_SECONDS = 300;

/** AD-14: drzewo kategorii (`listCategories`, `getCategoryByHandle`) — 600 s. */
export const CATEGORIES_CACHE_REVALIDATE_SECONDS = 600;

/** Scope tagów rewalidacji (spójne z zastanym `localeCacheTag`). */
export const PRODUCTS_CACHE_TAG_SCOPE = 'products';
export const CATEGORIES_CACHE_TAG_SCOPE = 'product-categories';
