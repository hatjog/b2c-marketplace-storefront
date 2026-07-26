/**
 * Rule: gp/require-set-request-locale
 *
 * Lint-gate AD-3 (v1.14.0 Story 1.3, AC4) — część (d): utrwala warunek
 * poprawności `getLocale()` (fix WS7 `6d73899b2`) na route'ach `[locale]`.
 *
 * Egzekwuje, że w plikach `src/app/[locale]/**` / `layout.tsx` | `page.tsx`:
 *
 *  (d1) KOMPONENT default-export (page/layout) woła `setRequestLocale(locale)`.
 *       Bez tego `getTranslations()`/`getLocale()` w drzewie renderu spada na
 *       default locale przy statycznym renderze.
 *
 *  (d2) KAŻDY eksportowany `generateMetadata` woła `setRequestLocale(locale)`.
 *       `generateMetadata` jest OSOBNYM wywołaniem poza drzewem page/layout —
 *       cichy fallback do `pl-PL` w tej kontynuacji to dokładnie przyczyna
 *       wycofania relandu PDP w v1.13.0 (AD-3 „Prevents").
 *
 *  (d3) KOLEJNOŚĆ: `setRequestLocale` musi poprzedzać (leksykalnie) pierwsze
 *       kontekstozależne `getTranslations('ns')` / `getTranslations()` /
 *       `getLocale()` w tej samej funkcji — wywołanie PO rozwiązaniu kontekstu
 *       jest no-opem dla już rozwiązanego locale (AC2). Jawna forma
 *       `getTranslations({ locale, … })` jest deterministyczna i NIE wymusza
 *       kolejności.
 *
 * Reguła jest CELOWO osobnym plikiem obok `locale-cache-boundary` (Story 1.2):
 * 1.3 DOKŁADA egzekwowanie AD-3, nie przepisuje mechaniki AD-1. Część (e)
 * AC4 (mercurClient ⇒ withMercurLocaleOptions) pokrywa już część (b) reguły
 * 1.2 na CAŁYM storefroncie — potwierdzone testem RuleTester na ścieżce
 * route'u detalu w __tests__/require-set-request-locale.test.js.
 *
 * Pomijane: pliki z dyrektywą "use client" (setRequestLocale to API serwerowe),
 * pliki testowe oraz wpisy z `allowlist` (opcja; wymaga uzasadnienia w PR).
 *
 * Znane ograniczenie (lustrzane wobec 1.2): reguła jest leksykalna. Default
 * export, którego nie da się rozwiązać do funkcji w tym samym module
 * (np. `export default withHoc(Page)` albo re-export), nie jest sprawdzany —
 * to gate przeciw regresji przez nieuwagę, nie sandbox.
 *
 * Cross-ref: AD-3 (`specs/releases/v1.14.0/architecture.md:48`), ADR-152,
 * `rules/locale-cache-boundary.js` (AD-1, Story 1.2).
 *
 * Authored: v1.14.0 Story 1.3.
 */
"use strict";

const DEFAULT_ROUTE_PATTERNS = ["src/app/[locale]/"];
const SET_LOCALE_NAME = "setRequestLocale";
/** Wywołania rozwiązujące locale z kontekstu requestu (formy kontekstozależne). */
const CONTEXT_RESOLVERS = ["getTranslations", "getLocale"];

function normalizePath(filename) {
  return String(filename || "").split("\\").join("/");
}

function matchesAny(filename, fragments) {
  return fragments.some((fragment) => filename.includes(fragment));
}

function isTestFile(filename) {
  return (
    filename.includes("/__tests__/") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)
  );
}

function isRouteEntryFile(filename, routePatterns) {
  if (!matchesAny(filename, routePatterns)) return false;
  return /\/(page|layout)\.[jt]sx?$/.test(filename);
}

/** Zdejmuje `await`, `as X`, `satisfies X` i nawiasy — jak w regule 1.2. */
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

function isFunctionNode(node) {
  return (
    !!node &&
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression")
  );
}

function walkAst(node, visit) {
  if (!node || typeof node.type !== "string") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((item) => walkAst(item, visit));
    } else if (child && typeof child.type === "string") {
      walkAst(child, visit);
    }
  }
}

function hasUseClientDirective(programNode) {
  return (programNode.body || []).some(
    (statement) =>
      statement.type === "ExpressionStatement" &&
      statement.expression &&
      statement.expression.type === "Literal" &&
      statement.expression.value === "use client"
  );
}

/**
 * Kontekstozależna forma resolvera: `getLocale(…)` zawsze; `getTranslations`
 * tylko bez argumentów albo z pierwszym argumentem nie-obiektowym (namespace).
 * `getTranslations({ locale, … })` dostaje locale jawnie — deterministyczne.
 */
function isContextResolverCall(node) {
  if (node.type !== "CallExpression") return false;
  const callee = unwrap(node.callee);
  if (!callee || callee.type !== "Identifier") return false;
  if (!CONTEXT_RESOLVERS.includes(callee.name)) return false;
  if (callee.name === "getLocale") return true;
  const firstArg = node.arguments.length > 0 ? unwrap(node.arguments[0]) : null;
  return !firstArg || firstArg.type !== "ObjectExpression";
}

function isSetRequestLocaleCall(node) {
  if (node.type !== "CallExpression") return false;
  const callee = unwrap(node.callee);
  return !!callee && callee.type === "Identifier" && callee.name === SET_LOCALE_NAME;
}

/**
 * Skanuje ciało funkcji: pierwsza pozycja `setRequestLocale(...)` i pierwsza
 * pozycja kontekstozależnego resolvera. Zagnieżdżone funkcje wliczają się do
 * subtree (wystarczy, że wołanie jest osiągalne leksykalnie z tej funkcji).
 */
function scanFunction(fnNode) {
  let firstSet = null;
  let firstResolve = null;
  walkAst(fnNode.body, (node) => {
    if (isSetRequestLocaleCall(node)) {
      if (firstSet === null || node.range[0] < firstSet) firstSet = node.range[0];
    } else if (isContextResolverCall(node)) {
      if (firstResolve === null || node.range[0] < firstResolve) {
        firstResolve = node.range[0];
      }
    }
  });
  return { firstSet, firstResolve };
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Egzekwuje AD-3: setRequestLocale(locale) w każdym [locale] layout/page ORAZ w eksportowanym generateMetadata, przed pierwszym kontekstozależnym getTranslations()/getLocale().",
    },
    schema: [
      {
        type: "object",
        properties: {
          routePatterns: { type: "array", items: { type: "string" } },
          allowlist: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingInComponent:
        "Komponent {{kind}} pod src/app/[locale]/** nie woła setRequestLocale(locale). Bez tego getTranslations()/getLocale() w drzewie renderu spada na default locale (AD-3, fix WS7).",
      missingInGenerateMetadata:
        "Eksportowany generateMetadata pod src/app/[locale]/** nie woła setRequestLocale(locale). generateMetadata to osobna kontynuacja poza drzewem page/layout — cichy fallback do pl-PL w metadanych to przyczyna wycofania relandu PDP w v1.13.0 (AD-3, Story 1.3 AC2).",
      setAfterResolve:
        "setRequestLocale(locale) występuje PO pierwszym kontekstozależnym {{resolver}} w tej funkcji — dla już rozwiązanego kontekstu to no-op. Przenieś setRequestLocale przed pierwsze getTranslations()/getLocale() (AC2), albo użyj jawnej formy getTranslations({ locale, … }).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const routePatterns = options.routePatterns || DEFAULT_ROUTE_PATTERNS;
    const allowlist = options.allowlist || [];

    const filename = normalizePath(
      context.filename || (context.getFilename && context.getFilename())
    );

    if (
      !isRouteEntryFile(filename, routePatterns) ||
      isTestFile(filename) ||
      matchesAny(filename, allowlist)
    ) {
      return {};
    }

    const isLayout = /\/layout\.[jt]sx?$/.test(filename);

    function checkFunction(fnNode, reportNode, messageId) {
      const { firstSet, firstResolve } = scanFunction(fnNode);
      if (firstSet === null) {
        context.report({
          node: reportNode,
          messageId,
          data: { kind: isLayout ? "layout" : "page" },
        });
        return;
      }
      if (firstResolve !== null && firstResolve < firstSet) {
        context.report({
          node: reportNode,
          messageId: "setAfterResolve",
          data: { resolver: "getTranslations()/getLocale()" },
        });
      }
    }

    return {
      Program(programNode) {
        if (hasUseClientDirective(programNode)) return;

        // Deklaracje top-level: nazwa → węzeł funkcji (dla resolvingu
        // `export default Page` / `export { generateMetadata }`).
        const declaredFunctions = new Map();
        for (const statement of programNode.body) {
          const decl =
            statement.type === "ExportNamedDeclaration" ||
            statement.type === "ExportDefaultDeclaration"
              ? statement.declaration
              : statement;
          if (!decl) continue;
          if (decl.type === "FunctionDeclaration" && decl.id) {
            declaredFunctions.set(decl.id.name, decl);
          } else if (decl.type === "VariableDeclaration") {
            for (const declarator of decl.declarations) {
              const init = declarator.init && unwrap(declarator.init);
              if (declarator.id.type === "Identifier" && isFunctionNode(init)) {
                declaredFunctions.set(declarator.id.name, init);
              }
            }
          }
        }

        for (const statement of programNode.body) {
          // (d1) default export = komponent page/layout.
          if (statement.type === "ExportDefaultDeclaration") {
            let fnNode = null;
            const decl = unwrap(statement.declaration);
            if (isFunctionNode(decl)) {
              fnNode = decl;
            } else if (decl && decl.type === "Identifier") {
              fnNode = declaredFunctions.get(decl.name) ?? null;
            }
            // Nierozwiązywalny kształt (HOC/re-export) — pomijamy (limitation).
            if (fnNode) {
              checkFunction(fnNode, statement, "missingInComponent");
            }
            continue;
          }

          // (d2) eksportowany generateMetadata.
          if (statement.type === "ExportNamedDeclaration") {
            const decl = statement.declaration;
            if (decl && decl.type === "FunctionDeclaration" && decl.id) {
              if (decl.id.name === "generateMetadata") {
                checkFunction(decl, decl.id, "missingInGenerateMetadata");
              }
            } else if (decl && decl.type === "VariableDeclaration") {
              for (const declarator of decl.declarations) {
                const init = declarator.init && unwrap(declarator.init);
                if (
                  declarator.id.type === "Identifier" &&
                  declarator.id.name === "generateMetadata" &&
                  isFunctionNode(init)
                ) {
                  checkFunction(init, declarator.id, "missingInGenerateMetadata");
                }
              }
            } else if (!decl && statement.specifiers) {
              for (const specifier of statement.specifiers) {
                if (
                  specifier.type === "ExportSpecifier" &&
                  specifier.exported &&
                  specifier.exported.name === "generateMetadata"
                ) {
                  const fnNode = declaredFunctions.get(specifier.local.name);
                  if (fnNode) {
                    checkFunction(fnNode, specifier, "missingInGenerateMetadata");
                  }
                }
              }
            }
          }
        }
      },
    };
  },
};
