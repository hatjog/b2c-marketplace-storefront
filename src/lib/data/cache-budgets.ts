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

/**
 * Scope tagów rewalidacji (spójne z zastanym `localeCacheTag`).
 *
 * JEDNA KONWENCJA — review-fix 1-2-F11: `src/lib/homepage/dynamic-blocks.ts`
 * tagował odczyt kategorii jako `categories-*`, więc rewalidacja
 * `product-categories-<locale>` nie zdmuchiwała bloków homepage (i odwrotnie).
 * Te stałe są teraz jedynym źródłem scope'u także dla `dynamic-blocks.ts` —
 * nie wprowadzaj kolejnego literału tagu, importuj stąd.
 *
 * NEGATYWNE CACHE'OWANIE — review-fix 1-2-F4: brak trafienia w
 * `getCategoryByHandle` NIE jest zapisywany jako wpis cache (fetcher rzuca
 * sentinel). Świeżo opublikowana kategoria nie zostaje więc 404 na cały TTL.
 * To celowo NIE mieści się w zaakceptowanej TTL-staleness powyżej: tam chodzi
 * o stare TREŚCI po re-syncu, tu o „nie ma takiego zasobu".
 *
 * AUTO-RESOLVE POZA CACHE SCOPE — review-fix 1-2-F5 (decyzja zapisana):
 * powierzchnie globalne (`Header`, `SiteHeader`, `EmptyCart`,
 * `EditorialDarkBandBlock`, `ProductListing` sidebar, `lib/seo/sitemap.ts`)
 * wołają `listCategories()` BEZ jawnego slugu. Jest to legalne (AC2 dopuszcza
 * auto-resolve poza cache scope) i świadome: te komponenty nie mają `params`
 * route'u, a locale rozwiązane przez `resolveStorefrontLocaleSlug()` jest
 * ustalane PRZED wejściem do cache, więc treść wpisu zawsze zgadza się
 * z jego kluczem. Trasy z dostępnym `params.locale` (`categories/**`,
 * `products/[handle]`, `cart`) przekazują slug jawnie.
 */
export const PRODUCTS_CACHE_TAG_SCOPE = 'products';
export const CATEGORIES_CACHE_TAG_SCOPE = 'product-categories';
