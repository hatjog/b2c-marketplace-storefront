/**
 * Rule: gp/locale-cache-boundary
 *
 * Lint-gate AD-1 (v1.14.0 Story 1.2, AC3). Pilnuje dwóch niezależnych granic,
 * których złamanie odtwarza bug cross-locale cache bleed (PL→UA, v1.12.0):
 *
 *  (a) BCP-47 W WARSTWIE DANYCH — w `src/lib/data/**` reprezentacją locale jest
 *      ZAWSZE slug routingu (`pl|en|ua|de`, typ `StorefrontLocaleSlug`).
 *      Literały `pl-PL` / `en-US` / `uk-UA` / `de-DE` oraz typ `CanonicalLocale`
 *      są tam zakazane. Konwersja slug → BCP-47 ma jedno miejsce:
 *      `src/lib/sdk/locale-interceptor.ts` (`withLocaleHeaderForSlug`), które
 *      jest jedynym wpisem na allowliście.
 *
 *      Powód: gdy fetcher operuje na BCP-47, granica cache przestaje być
 *      jednoznaczna — ta sama treść ląduje pod dwoma kluczami albo (gorzej)
 *      dwie treści pod jednym.
 *
 *  (b) GOŁE `mercurClient` — `mercurClient` NIE przechodzi przez
 *      `applyLocaleInterceptor` (patrz `src/lib/config.ts`), więc każde
 *      `mercurClient.store.*.query(...)` musi dostać argumenty owinięte
 *      `withMercurLocaleOptions(...)` albo — w cache scope —
 *      `withMercurLocaleOptionsForSlug(...)`. Bez tego `x-medusa-locale` nie
 *      wychodzi i backend zwraca default locale.
 *
 *      Do v1.14.0 egzekwowała to wyłącznie dyscyplina code review; `config.ts`
 *      wprost zapowiadał tę regułę jako follow-up. To jest ten follow-up.
 *
 * Zakres (b) celowo obejmuje CAŁY storefront, nie tylko `src/lib/data/**` —
 * `mercurClient` jest wołany także z `src/lib/sdk-adapters/**`.
 *
 * Znane ograniczenie: aliasowanie śledzone jest tylko dla prostych deklaracji
 * `const c = mercurClient` / `const c = mercurClient as X` w tym samym module.
 * Przekazanie klienta przez parametr funkcji lub pole obiektu nie jest
 * wykrywane — to gate przeciw regresji przez nieuwagę, nie sandbox.
 *
 * Cross-ref: AD-1 (`specs/releases/v1.14.0/architecture.md`), ADR-152,
 * `src/lib/sdk/locale-interceptor.ts`, Story 1.3 rozszerza gate o AD-3.
 *
 * Authored: v1.14.0 Story 1.2.
 */
"use strict";

const DEFAULT_BCP47_LOCALES = ["pl-PL", "en-US", "uk-UA", "de-DE"];
const DEFAULT_BANNED_TYPES = ["CanonicalLocale"];
const DEFAULT_DATA_LAYER_PATTERNS = ["src/lib/data/"];
const DEFAULT_ALLOWLIST = ["src/lib/sdk/locale-interceptor.ts"];
const MERCUR_CLIENT_NAME = "mercurClient";
const LOCALE_OPTION_WRAPPERS = [
  "withMercurLocaleOptions",
  "withMercurLocaleOptionsForSlug",
];

/** Normalizuje separatory ścieżek, żeby reguła działała tak samo na Windows. */
function normalizePath(filename) {
  return String(filename || "").split("\\").join("/");
}

function matchesAny(filename, fragments) {
  return fragments.some((fragment) => filename.includes(fragment));
}

/** Pliki testowe warstwy danych mogą mówić o BCP-47 — asertują konwersję. */
function isTestFile(filename) {
  return (
    filename.includes("/__tests__/") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)
  );
}

/** Zdejmuje `await`, `as X`, `satisfies X`, `<X>expr` i nawiasy. */
function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === "AwaitExpression" ||
      current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSTypeAssertion")
  ) {
    current = current.expression ?? current.argument;
  }
  return current;
}

/** Zwraca identyfikator korzenia łańcucha `a.b.c` / `a?.b?.c`. */
function rootIdentifier(node) {
  let current = unwrap(node);
  while (
    current &&
    (current.type === "MemberExpression" || current.type === "ChainExpression")
  ) {
    current = unwrap(
      current.type === "ChainExpression" ? current.expression : current.object
    );
  }
  return current && current.type === "Identifier" ? current : null;
}

function isLocaleOptionWrapperCall(node) {
  const expr = unwrap(node);
  if (!expr || expr.type !== "CallExpression") return false;
  const callee = unwrap(expr.callee);
  return (
    callee &&
    callee.type === "Identifier" &&
    LOCALE_OPTION_WRAPPERS.includes(callee.name)
  );
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Egzekwuje granicę locale AD-1: slug (nie BCP-47) w warstwie danych oraz withMercurLocaleOptions na mercurClient.",
    },
    schema: [
      {
        type: "object",
        properties: {
          bcp47Locales: { type: "array", items: { type: "string" } },
          bannedTypes: { type: "array", items: { type: "string" } },
          dataLayerPatterns: { type: "array", items: { type: "string" } },
          allowlist: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      bcp47Literal:
        'Literał BCP-47 "{{value}}" w warstwie danych. Granica cache to slug routingu (StorefrontLocaleSlug: pl|en|ua|de) — konwersję na BCP-47 robi wyłącznie withLocaleHeaderForSlug w src/lib/sdk/locale-interceptor.ts (AD-1).',
      bannedType:
        "Typ {{name}} (BCP-47) w warstwie danych. Użyj StorefrontLocaleSlug — fetchery nie operują na pl-PL/uk-UA (AD-1, Story 1.2 AC3).",
      bareMercurClient:
        "Gołe wywołanie {{name}} — mercurClient nie przechodzi przez applyLocaleInterceptor. Owiń argumenty w withMercurLocaleOptions(...) lub (w cache scope) withMercurLocaleOptionsForSlug(..., locale).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const bcp47Locales = options.bcp47Locales || DEFAULT_BCP47_LOCALES;
    const bannedTypes = options.bannedTypes || DEFAULT_BANNED_TYPES;
    const dataLayerPatterns =
      options.dataLayerPatterns || DEFAULT_DATA_LAYER_PATTERNS;
    const allowlist = options.allowlist || DEFAULT_ALLOWLIST;

    const filename = normalizePath(
      context.filename || (context.getFilename && context.getFilename())
    );

    const isAllowlisted = matchesAny(filename, allowlist);
    const enforceDataLayer =
      !isAllowlisted &&
      !isTestFile(filename) &&
      matchesAny(filename, dataLayerPatterns);

    // Lokalne aliasy `mercurClient` w tym module (`const c = mercurClient as X`).
    const mercurAliases = new Set([MERCUR_CLIENT_NAME]);

    const visitors = {
      VariableDeclarator(node) {
        if (!node.init || node.id.type !== "Identifier") return;
        const init = unwrap(node.init);
        if (init && init.type === "Identifier" && mercurAliases.has(init.name)) {
          mercurAliases.add(node.id.name);
        }
      },

      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (!callee || callee.type !== "MemberExpression") return;

        const root = rootIdentifier(callee);
        if (!root || !mercurAliases.has(root.name)) return;

        // Wołanie na aliasie mercurClient: pierwszy argument MUSI pochodzić
        // z wrappera locale. Brak argumentów = brak nagłówka = default leak.
        if (node.arguments.length === 0) {
          context.report({
            node,
            messageId: "bareMercurClient",
            data: { name: root.name },
          });
          return;
        }

        if (!isLocaleOptionWrapperCall(node.arguments[0])) {
          context.report({
            node,
            messageId: "bareMercurClient",
            data: { name: root.name },
          });
        }
      },
    };

    if (enforceDataLayer) {
      visitors.Literal = function (node) {
        if (typeof node.value !== "string") return;
        if (!bcp47Locales.includes(node.value)) return;
        context.report({
          node,
          messageId: "bcp47Literal",
          data: { value: node.value },
        });
      };

      visitors.TemplateElement = function (node) {
        const raw = node.value && node.value.raw;
        if (!raw) return;
        const hit = bcp47Locales.find((locale) => raw.includes(locale));
        if (!hit) return;
        context.report({
          node,
          messageId: "bcp47Literal",
          data: { value: hit },
        });
      };

      // Łapie i `import type { CanonicalLocale }`, i użycie w adnotacji typu.
      visitors.Identifier = function (node) {
        if (!bannedTypes.includes(node.name)) return;
        // Pomijamy pozycję właściwości obiektu (`{ CanonicalLocale: … }`),
        // żeby nie raportować przypadkowej zbieżności nazw.
        const parent = node.parent;
        if (
          parent &&
          parent.type === "Property" &&
          parent.key === node &&
          !parent.computed
        ) {
          return;
        }
        // `import { CanonicalLocale }` daje dwa węzły (imported + local) dla
        // tej samej nazwy — raportujemy import raz.
        if (
          parent &&
          parent.type === "ImportSpecifier" &&
          parent.local === node &&
          parent.imported &&
          parent.imported !== node
        ) {
          return;
        }
        context.report({
          node,
          messageId: "bannedType",
          data: { name: node.name },
        });
      };
    }

    return visitors;
  },
};
