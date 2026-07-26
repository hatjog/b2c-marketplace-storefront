/**
 * Tests for gp/locale-cache-boundary (v1.14.0 Story 1.2, AC3).
 *
 * Run via: `pnpm test:eslint-rules` (albo bezpośrednio
 * `node eslint-plugin-gp/rules/__tests__/locale-cache-boundary.test.js`).
 *
 * Test dowodzi EGZEKWOWALNOŚCI, nie samej obecności pliku reguły: sekcja
 * `invalid` zawiera dokładnie te regresje, które reguła ma blokować
 * (BCP-47 w fetcherze, typ CanonicalLocale w fetcherze, gołe mercurClient).
 * RuleTester failuje, jeśli którakolwiek z nich przestanie być zgłaszana.
 */
"use strict";

const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../locale-cache-boundary");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
});

const DATA_FILE = "/repo/GP/storefront/src/lib/data/products.ts";
const ADAPTER_FILE = "/repo/GP/storefront/src/lib/sdk-adapters/sellers.ts";
const INTERCEPTOR_FILE = "/repo/GP/storefront/src/lib/sdk/locale-interceptor.ts";
const DATA_TEST_FILE =
  "/repo/GP/storefront/src/lib/data/__tests__/categories-locale.test.ts";
const COMPONENT_FILE = "/repo/GP/storefront/src/components/atoms/Foo.tsx";

ruleTester.run("locale-cache-boundary", rule, {
  valid: [
    // (a) Slug union type w warstwie danych — kanoniczny kształt AD-1.
    {
      filename: DATA_FILE,
      code: `
        import type { StorefrontLocaleSlug } from '@/lib/sdk/locale-interceptor';
        export const listThings = async (locale: StorefrontLocaleSlug) => locale;
      `,
    },
    // (a) Slugi 'pl'/'ua' są legalne — zakazane są tylko formy BCP-47.
    {
      filename: DATA_FILE,
      code: `const slugs = ['pl', 'en', 'ua', 'de'];`,
    },
    // (a) Allowlist: locale-interceptor.ts JEST miejscem konwersji na BCP-47.
    {
      filename: INTERCEPTOR_FILE,
      code: `
        export type CanonicalLocale = 'pl-PL' | 'en-US' | 'uk-UA' | 'de-DE';
        const map = { pl: 'pl-PL', ua: 'uk-UA' };
      `,
    },
    // (a) Testy warstwy danych mogą asertować konwersję slug → BCP-47.
    {
      filename: DATA_TEST_FILE,
      code: `
        import type { CanonicalLocale } from '../../sdk/locale-interceptor';
        const expected: CanonicalLocale = 'uk-UA';
      `,
    },
    // (a) Poza warstwą danych BCP-47 nie jest przedmiotem tej reguły.
    {
      filename: COMPONENT_FILE,
      code: `const htmlLang = 'uk-UA';`,
    },
    // (b) mercurClient owinięty asynchronicznym wrapperem — wzorzec sellers.ts.
    {
      filename: ADAPTER_FILE,
      code: `
        const result = await mercurClient.store.sellers.query(
          await withMercurLocaleOptions({ handle, limit: 1 })
        );
      `,
    },
    // (b) Wariant cache-scope (synchroniczny, jawny slug).
    {
      filename: ADAPTER_FILE,
      code: `
        const result = await mercurClient.store.sellers.query(
          withMercurLocaleOptionsForSlug({ handle }, locale)
        );
      `,
    },
    // (b) Alias mercurClient przez `as` — nadal owinięty, więc legalny.
    {
      filename: DATA_FILE,
      code: `
        const client = mercurClient as unknown as { store: any };
        const res = await client.store.vouchers.byCode(await withMercurLocaleOptions({ code }));
      `,
    },
    // (b) Wywołania innych klientów reguły nie dotyczą.
    {
      filename: DATA_FILE,
      code: `const res = await sdk.client.fetch('/store/products', { method: 'GET' });`,
    },
  ],

  invalid: [
    // (a) REGRESJA: literał BCP-47 wraca do fetchera warstwy danych.
    {
      filename: DATA_FILE,
      code: `const headers = { 'x-medusa-locale': 'uk-UA' };`,
      errors: [{ messageId: "bcp47Literal" }],
    },
    // (a) REGRESJA: BCP-47 wstrzyknięty przez template literal.
    {
      filename: DATA_FILE,
      code: "const tag = `products-${'x'}-pl-PL`;",
      errors: [{ messageId: "bcp47Literal" }],
    },
    // (a) REGRESJA: typ CanonicalLocale w sygnaturze fetchera.
    {
      filename: DATA_FILE,
      code: `
        import type { CanonicalLocale } from '@/lib/sdk/locale-interceptor';
        export const listThings = async (locale: CanonicalLocale) => locale;
      `,
      // import + adnotacja typu = dwa wystąpienia identyfikatora.
      errors: [{ messageId: "bannedType" }, { messageId: "bannedType" }],
    },
    // (b) REGRESJA: gołe mercurClient bez wrappera locale.
    {
      filename: ADAPTER_FILE,
      code: `const result = await mercurClient.store.sellers.query({ handle });`,
      errors: [{ messageId: "bareMercurClient" }],
    },
    // (b) REGRESJA: wywołanie bez argumentów (brak nagłówka locale).
    {
      filename: ADAPTER_FILE,
      code: `const result = await mercurClient.store.sellers.query();`,
      errors: [{ messageId: "bareMercurClient" }],
    },
    // (b) REGRESJA: alias mercurClient obchodzący wrapper.
    {
      filename: DATA_FILE,
      code: `
        const client = mercurClient as unknown as { store: any };
        const res = await client.store.vouchers.byCode({ code });
      `,
      errors: [{ messageId: "bareMercurClient" }],
    },
    // (b) Optional chaining nie jest furtką.
    {
      filename: ADAPTER_FILE,
      code: `const result = await mercurClient.store?.sellers?.query({ handle });`,
      errors: [{ messageId: "bareMercurClient" }],
    },
  ],
});

// RuleTester rzuca przy pierwszym niezgodnym przypadku; dojście tutaj = zielono.
// eslint-disable-next-line no-console
console.log("locale-cache-boundary: OK");
