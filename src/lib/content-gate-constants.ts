/**
 * Stałe gate'u treści bez zależności `server-only` — wydzielone z
 * `content-gate.ts` (review 1-4-F8): tamten moduł czyta fs i nie może być
 * importowany przez helpery współdzielone z torami bez kontekstu locale
 * (`normalize-listed-products.ts`). Dzięki temu slug FAZY 1 ma JEDNĄ kopię
 * w kodzie storefrontu zamiast literałów rozsianych po modułach; trzecią
 * kopię (w `scripts/smoke-pdp-locales.mjs`, granica ESM/.mjs) wiąże test
 * parity `smoke-threshold-parity.test.ts`.
 */
import type { SupportedLocale } from '@/i18n/routing';

/**
 * Slug baru używany w FAZIE 1 dla KAŻDEGO locale requestu (AD-4, ADR-164 §2).
 */
export const PHASE_1_GATE_SLUG: SupportedLocale = 'pl';
