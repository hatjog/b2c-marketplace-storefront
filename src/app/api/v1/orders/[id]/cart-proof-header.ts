/**
 * Nagłówek dowodu koszyka — kontrakt WSPÓLNY z backendem.
 *
 * Druga strona: `CART_PROOF_HEADER` w
 * `GP/backend/packages/api/src/api/middlewares/upstream-order-access-guard.ts`.
 *
 * ## Dlaczego nagłówek, a nie `?cart_id=`
 *
 * `/store/orders/:id` jest trasą core Medusy, a jej `validateAndTransformQuery`
 * odrzuca nieznane pola zapytania kodem 400 ZANIM nasze middleware cokolwiek
 * zobaczy. Zmierzone `curl`-em na żywym stacku 2026-08-11: `?cart_id=<poprawny>`
 * i `?cart_id=<fałszywy>` dają identyczne `400 Unrecognized fields: 'cart_id'`.
 * Bramka podnosząca próg dostępu była przez to MARTWA na realnej ścieżce —
 * odmawiała gościom bezbłędnie, a jedynego dowodu, który akceptowała, nie dało
 * się dostarczyć. Walidator core nie dotyka nagłówków, więc ten kanał nie zależy
 * od wersji Medusy.
 *
 * ## Znane sprzężenie
 *
 * Ten literał jest POWIELONY w dwóch repozytoriach i nie pilnuje go żaden test
 * — rozjazd nazw jest możliwy i objawiłby się jako 401 dla każdego gościa.
 * Jedynym dowodem drożności pozostaje pomiar na żywym stacku.
 *
 * ## Dlaczego w osobnym pliku
 *
 * Next.js App Router zabrania modułowi trasy eksportować cokolwiek poza
 * handlerami i zadeklarowaną konfiguracją; `export const CART_PROOF_HEADER`
 * w `route.ts` wywracał `tsc` na wygenerowanym typie trasy.
 */
export const CART_PROOF_HEADER = 'x-gp-cart-proof';
