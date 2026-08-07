/**
 * Stałe ścieżki powrotu z 3D Secure — Story 3.6 (AC2/AC3/AC4).
 *
 * DLACZEGO OSOBNY MODUŁ: `payment-return.ts` ma dyrektywę `'use server'`, a Next
 * pozwala eksportować z takiego pliku WYŁĄCZNIE funkcje asynchroniczne. Eksport
 * zwykłej stałej wywala kompilację całego grafu modułów:
 *
 *   x Only async functions are allowed to be exported in a "use server" file.
 *
 * Skutek nie jest lokalny — `/pl`, `/pl/categories` i `/pl/cart` oddawały 500,
 * bo dev server pokazuje błąd kompilacji dla całej aplikacji (zmierzone
 * 2026-08-07). Vitest tego nie łapie: importuje moduł bez kompilatora Next,
 * więc reguła `'use server'` nie jest tam w ogóle egzekwowana.
 *
 * Te wartości są czystymi danymi i nie mają czego robić w module serwerowym.
 */

/**
 * Znacznik „byłam już u Route Handlera". Bez niego strona, dla której
 * domknięcie nie dało zamówienia, odsyłałaby do handlera w nieskończoność.
 * Obecność znacznika czyni z powrotu czysty ODCZYT.
 */
export const PAYMENT_RETURN_DONE_PARAM = 'gp_return';

export const PAYMENT_RETURN_DONE_VALUE = 'done';

/** Ścieżka Route Handlera domykającego koszyk. Jedno miejsce, jedna prawda. */
export const PAYMENT_RETURN_COMPLETION_PATH = '/api/v1/checkout/payment-return';
