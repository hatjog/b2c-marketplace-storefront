/**
 * eslint-plugin-gp — GP storefront local plugin.
 *
 * v1.9.1 Wave G5: introduces `no-storefront-color-literals` to enforce
 * the DS-token-only color discipline closing CC-3 H1.
 *
 * v1.13.0 Story 2.2: introduces `no-hardcoded-i18n-strings` as an
 * AST static guard for JSX text and i18n-sensitive attributes.
 *
 * v1.14.0 Story 1.2: introduces `locale-cache-boundary` — lint-gate AD-1
 * pilnujący, że warstwa danych operuje na slugach (nie BCP-47) i że każde
 * wywołanie `mercurClient` przechodzi przez `withMercurLocaleOptions*`.
 *
 * v1.14.0: introduces `i18n-namespace-key-resolves` — lint-gate przeciwko
 * dryfowi namespace↔klucz w next-intl. Parity katalogów nie widzi przypadku,
 * w którym klucz ISTNIEJE, ale pod innym namespace niż ten otwarty przez
 * komponent; taki klucz rzuca fail-loud w rawKeyGuard i zwraca 500. Ta klasa
 * błędu trafiła na produkcję dwukrotnie (checkout `voucher_delivery_label`,
 * seller hero `verified_seller`).
 *
 * v1.14.0 Story 1.3: introduces `require-set-request-locale` — lint-gate AD-3
 * (rozszerzenie gate'u 1.2 NOWĄ regułą obok, nie przepisaniem): każdy
 * `[locale]` layout/page ORAZ eksportowany `generateMetadata` woła
 * `setRequestLocale(locale)` przed kontekstozależnym `getTranslations()`.
 *
 * v1.14.0 QD-03: introduces `explicit-locale-get-translations` — bramka CAP-3
 * na GRANICY RENDERU: jeśli `locale` jest w zasięgu, tłumaczenia MUSZĄ iść
 * jawną formą `getTranslations({ locale, namespace })`. Forma skrócona poza
 * drzewem page/layout dziedziczy pusty request store i cicho spada na `pl`
 * (polski chrome PDP na /ua, /de, /en — audyt kompletności i18n v1.14.0).
 * Route entries pod `src/app/**` rządzi `require-set-request-locale`.
 *
 * Companion validator: `_grow/tools/validate_storefront_ds_literals.py`.
 * Cross-ref: ADR-119 token replication, D-V180-ARCH-3 SSOT boundary,
 * ux.md §5.5 token discipline.
 */
"use strict";

const noColorLiterals = require("./rules/no-color-literals");
const noHardcodedI18nStrings = require("./rules/no-hardcoded-i18n-strings");
const localeCacheBoundary = require("./rules/locale-cache-boundary");
const requireSetRequestLocale = require("./rules/require-set-request-locale");
const i18nNamespaceKeyResolves = require("./rules/i18n-namespace-key-resolves");
const explicitLocaleGetTranslations = require("./rules/explicit-locale-get-translations");

module.exports = {
  rules: {
    "no-storefront-color-literals": noColorLiterals,
    "no-hardcoded-i18n-strings": noHardcodedI18nStrings,
    "locale-cache-boundary": localeCacheBoundary,
    "require-set-request-locale": requireSetRequestLocale,
    "i18n-namespace-key-resolves": i18nNamespaceKeyResolves,
    "explicit-locale-get-translations": explicitLocaleGetTranslations,
  },
  configs: {
    recommended: {
      plugins: ["gp"],
      rules: {
        "gp/no-storefront-color-literals": "error",
        "gp/no-hardcoded-i18n-strings": "error",
        "gp/locale-cache-boundary": "error",
        "gp/require-set-request-locale": "error",
        "gp/i18n-namespace-key-resolves": "error",
        "gp/explicit-locale-get-translations": "error",
      },
    },
  },
};
