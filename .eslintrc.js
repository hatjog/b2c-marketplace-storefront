const i18nHardcodedAllowlist = require("./eslint-plugin-gp/i18n-hardcoded-allowlist.json")

module.exports = {
  extends: ["next/core-web-vitals"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import", "gp"],
  settings: {
    "import/resolver": {
      typescript: true,
    },
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    }],
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "no-console": ["error", { allow: ["error", "warn"] }],
    "no-restricted-globals": ["error",
      { name: "event", message: "Use local parameter instead of global 'event'." },
      { name: "name", message: "Use a local variable instead of global 'name'." },
      { name: "status", message: "Use a local variable instead of global 'status'." },
    ],
    "import/no-relative-parent-imports": "off",
    "eqeqeq": ["error", "always", { "null": "ignore" }],
    // v1.9.1 Wave G5 — CC-3 H1 closure. Disallow raw color literals
    // (#hex, rgb(), rgba(), hsl(), hsla()) in storefront source files.
    // All color values must consume the DS token registry via
    // var(--token-name) from src/styles/tokens/*.css. Companion Python
    // validator: _grow/tools/validate_storefront_ds_literals.py.
    "gp/no-storefront-color-literals": "error",
    // v1.13.0 Story 2.2 — AST static guard for hardcoded user-visible
    // strings in TSX JSX text and localization-sensitive attrs.
    "gp/no-hardcoded-i18n-strings": ["error", { allowlist: i18nHardcodedAllowlist }],
    // v1.14.0 Story 1.2 — lint-gate AD-1 (locale-keyed Data Cache).
    // (a) w src/lib/data/** locale to slug routingu, nigdy BCP-47 —
    //     konwersję robi wyłącznie src/lib/sdk/locale-interceptor.ts;
    // (b) mercurClient nie przechodzi przez applyLocaleInterceptor, więc
    //     każde wywołanie musi iść przez withMercurLocaleOptions*.
    "gp/locale-cache-boundary": "error",
    // v1.14.0 Story 1.3 — lint-gate AD-3 (reland lokalizowanego fetchu);
    // rozszerzenie gate'u 1.2 NOWĄ regułą obok (części (a)-(c) nietknięte):
    // (d) każdy [locale] layout/page ORAZ eksportowany generateMetadata woła
    //     setRequestLocale(locale) PRZED kontekstozależnym getTranslations();
    // (e) mercurClient ⇒ withMercurLocaleOptions* pokrywa już część (b) 1.2
    //     na całym storefroncie (w tym route'y detalu) — patrz testy reguły.
    "gp/require-set-request-locale": "error",
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        "message": "dangerouslySetInnerHTML is banned. Use <SanitizedHTML> server component (SSR) or sanitizeOnFetch() utility (CSR). See Story 0.4."
      },
      {
        "selector": "AssignmentExpression[left.property.name='innerHTML']",
        "message": "innerHTML assignment is banned. Use <SanitizedHTML> or sanitizeOnFetch(). See Story 0.4."
      },
      {
        "selector": "CallExpression[callee.object.name='document'][callee.property.name='write']",
        "message": "document.write() is banned. See Story 0.4."
      }
    ],
  },
}
