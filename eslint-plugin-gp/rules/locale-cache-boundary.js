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
 *  (c) AUTO-RESOLVE W CACHE SCOPE (review-fix 1-2-F3) — wewnątrz callbacku
 *      `unstable_cache` / `createLocaleKeyedCache` NIE WOLNO wołać helperów,
 *      które rozwiązują locale z kontekstu requestu (`withMercurLocaleOptions`,
 *      `withLocaleHeader`, `localeCacheTag`, `resolveStorefrontLocale*`).
 *      Bez (c) gate „zapewniał" wyłącznie obecność JAKIEGOKOLWIEK wrappera,
 *      a nie właściwość nazwaną w AC2: jawność locale w cache scope. To jest
 *      dokładnie ta klasa błędu, którą reguła miała blokować.
 *
 * Zakres (b) i (c) celowo obejmuje CAŁY storefront, nie tylko `src/lib/data/**`;
 * zakres (a) obejmuje `src/lib/data/**` ORAZ `src/lib/sdk-adapters/**`, bo tam
 * też stoją fetchery trzymające locale na granicy `unstable_cache`.
 *
 * Znane ograniczenie: aliasowanie śledzone jest tylko dla deklaracji
 * `const c = mercurClient` / `const c = mercurClient as X` w tym samym module
 * (kolejność deklaracji nie ma znaczenia — aliasy i zmienne z wrapperów są
 * zbierane w prescanie na `Program`, do punktu stałego). Przekazanie klienta
 * przez parametr funkcji lub pole obiektu nie jest wykrywane — to gate przeciw
 * regresji przez nieuwagę, nie sandbox.
 *
 * Część (b) celuje w METODY WYSYŁAJĄCE ŻĄDANIE (`requestMethods`, domyślnie
 * `query`/`fetch`/`graph`), a nie w każde wywołanie rooted w `mercurClient` —
 * inaczej `mercurClient.client.setToken(token)` wymagałby wrappera locale.
 * Dokładając nową metodę do proxy Mercura, dopisz ją do tej listy.
 *
 * Cross-ref: AD-1 (`specs/releases/v1.14.0/architecture.md`), ADR-152,
 * `src/lib/sdk/locale-interceptor.ts`, Story 1.3 rozszerza gate o AD-3.
 *
 * Authored: v1.14.0 Story 1.2.
 */
"use strict";

const DEFAULT_BCP47_LOCALES = ["pl-PL", "en-US", "uk-UA", "de-DE"];
const DEFAULT_BANNED_TYPES = ["CanonicalLocale"];
// (a) obejmuje też sdk-adapters — tam stoi `resolveSellerHandleToIdCached`,
// czyli fetcher trzymający locale na granicy `unstable_cache` (1-2-F3).
const DEFAULT_DATA_LAYER_PATTERNS = ["src/lib/data/", "src/lib/sdk-adapters/"];
const DEFAULT_ALLOWLIST = ["src/lib/sdk/locale-interceptor.ts"];
const MERCUR_CLIENT_NAME = "mercurClient";
const LOCALE_OPTION_WRAPPERS = [
  "withMercurLocaleOptions",
  "withMercurLocaleOptionsForSlug",
];
/** Metody proxy Mercura, które faktycznie wysyłają żądanie (1-2-F7 #2). */
const DEFAULT_REQUEST_METHODS = ["query", "fetch", "graph"];
/** Fabryki cache scope — ich callbacki nie mają kontekstu requestu. */
const CACHE_SCOPE_FACTORIES = ["unstable_cache", "createLocaleKeyedCache"];
/** Helpery rozwiązujące locale z kontekstu requestu — zakazane w cache scope. */
const AUTO_RESOLVE_HELPERS = [
  "withMercurLocaleOptions",
  "withLocaleHeader",
  "localeCacheTag",
  "resolveStorefrontLocale",
  "resolveStorefrontLocaleSlug",
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

/** Nazwa wołanej funkcji, jeśli wywołanie jest `nazwa(...)`. */
function calleeName(node) {
  const expr = unwrap(node);
  if (!expr || expr.type !== "CallExpression") return null;
  const callee = unwrap(expr.callee);
  return callee && callee.type === "Identifier" ? callee.name : null;
}

function isLocaleOptionWrapperCall(node) {
  const name = calleeName(node);
  return name !== null && LOCALE_OPTION_WRAPPERS.includes(name);
}

/**
 * Nazwa metody na końcu łańcucha `a.b.c(...)` — czyli `c`. Wspiera
 * `a?.b?.c(...)` (ChainExpression) i wołania computed pomija (`a['q']()`).
 */
function calledMethodName(callee) {
  const member = unwrap(callee);
  if (!member || member.type !== "MemberExpression") return null;
  if (member.computed) return null;
  const property = member.property;
  return property && property.type === "Identifier" ? property.name : null;
}

/**
 * Prescan całego modułu (1-2-F7 #3): zbiera aliasy `mercurClient` oraz zmienne
 * zainicjalizowane wrapperem locale. Wykonany na `Program`, czyli PRZED
 * jakimkolwiek `CallExpression`, więc wynik nie zależy od kolejności deklaracji
 * (`const f = () => client.store.x.query({}); const client = mercurClient;`
 * jest teraz wykrywany). Powtarzamy do punktu stałego, żeby złapać alias aliasu.
 */
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

function prescanDeclarations(programNode, mercurAliases, wrapperVars) {
  let changed = true;
  // Punkt stały: każdy przebieg może odkryć alias zależny od aliasu odkrytego
  // w poprzednim. Zbiory tylko rosną, więc pętla zawsze się kończy.
  while (changed) {
    const before = mercurAliases.size + wrapperVars.size;

    walkAst(programNode, (node) => {
      if (node.type !== "VariableDeclarator") return;
      if (!node.init || node.id.type !== "Identifier") return;

      const init = unwrap(node.init);
      if (!init) return;

      if (init.type === "Identifier" && mercurAliases.has(init.name)) {
        mercurAliases.add(node.id.name);
        return;
      }

      if (isLocaleOptionWrapperCall(init)) {
        wrapperVars.add(node.id.name);
        return;
      }

      if (init.type === "Identifier" && wrapperVars.has(init.name)) {
        wrapperVars.add(node.id.name);
      }
    });

    changed = mercurAliases.size + wrapperVars.size > before;
  }
}

/** Czy węzeł leży leksykalnie wewnątrz callbacku cache scope (część (c)). */
function isInsideCacheScope(ancestors) {
  return ancestors.some(
    (ancestor) =>
      ancestor.type === "CallExpression" &&
      ancestor.callee &&
      ancestor.callee.type === "Identifier" &&
      CACHE_SCOPE_FACTORIES.includes(ancestor.callee.name)
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
          requestMethods: { type: "array", items: { type: "string" } },
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
      autoResolveInCacheScope:
        "{{name}} rozwiązuje locale z kontekstu requestu, a to wywołanie jest wewnątrz callbacku cache ({{factory}}). W cache scope nie ma headers()/cookies()/getLocale() — użyj wariantu *ForSlug z jawnym slugiem (AD-1, Story 1.2 AC2).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const bcp47Locales = options.bcp47Locales || DEFAULT_BCP47_LOCALES;
    const bannedTypes = options.bannedTypes || DEFAULT_BANNED_TYPES;
    const dataLayerPatterns =
      options.dataLayerPatterns || DEFAULT_DATA_LAYER_PATTERNS;
    const allowlist = options.allowlist || DEFAULT_ALLOWLIST;
    const requestMethods = options.requestMethods || DEFAULT_REQUEST_METHODS;

    const filename = normalizePath(
      context.filename || (context.getFilename && context.getFilename())
    );

    const isAllowlisted = matchesAny(filename, allowlist);
    const enforceDataLayer =
      !isAllowlisted &&
      !isTestFile(filename) &&
      matchesAny(filename, dataLayerPatterns);

    // Lokalne aliasy `mercurClient` w tym module (`const c = mercurClient as X`)
    // oraz zmienne trzymające wynik wrappera locale — oba napełniane prescanem
    // na `Program`, żeby wynik nie zależał od kolejności traversal (1-2-F7 #3).
    const mercurAliases = new Set([MERCUR_CLIENT_NAME]);
    const wrapperVars = new Set();

    /** Pierwszy argument pochodzi z wrappera locale — wprost albo przez zmienną. */
    function isLocaleOptionArgument(node) {
      if (isLocaleOptionWrapperCall(node)) return true;
      const expr = unwrap(node);
      return !!expr && expr.type === "Identifier" && wrapperVars.has(expr.name);
    }

    const visitors = {
      Program(node) {
        prescanDeclarations(node, mercurAliases, wrapperVars);
      },

      CallExpression(node) {
        const callee = unwrap(node.callee);

        // (c) auto-resolve locale wewnątrz callbacku cache scope.
        const directCallee = calleeName(node);
        if (!isTestFile(filename) && AUTO_RESOLVE_HELPERS.includes(directCallee)) {
          const sourceCode = context.sourceCode || context.getSourceCode();
          const ancestors = sourceCode.getAncestors
            ? sourceCode.getAncestors(node)
            : context.getAncestors();
          const factory = ancestors.find(
            (ancestor) =>
              ancestor.type === "CallExpression" &&
              ancestor.callee &&
              ancestor.callee.type === "Identifier" &&
              CACHE_SCOPE_FACTORIES.includes(ancestor.callee.name)
          );
          if (factory) {
            context.report({
              node,
              messageId: "autoResolveInCacheScope",
              data: { name: directCallee, factory: factory.callee.name },
            });
          }
        }

        if (!callee || callee.type !== "MemberExpression") return;

        const root = rootIdentifier(callee);
        if (!root || !mercurAliases.has(root.name)) return;

        // (b) celujemy w metody wysyłające żądanie, nie w każde wywołanie
        // rooted w `mercurClient` (`…client.setToken(token)` nie potrzebuje
        // nagłówka locale) — 1-2-F7 #2.
        const method = calledMethodName(callee);
        if (!method || !requestMethods.includes(method)) return;

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

        if (!isLocaleOptionArgument(node.arguments[0])) {
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
