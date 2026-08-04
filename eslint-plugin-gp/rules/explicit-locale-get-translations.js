/**
 * Rule: gp/explicit-locale-get-translations
 *
 * CAP-3 (`specs/spec-storefront-i18n-completeness/SPEC.md`), pakiet QD-03.
 *
 * Blokuje jedną, wąską i mierzalną klasę defektu: komponent MA locale w zasięgu
 * leksykalnym, a mimo to czyta tłumaczenia formą rozwiązywaną z request store
 * (`getTranslations('ns')` / `getTranslations()`). Taki kod jest zakładem o to,
 * że kontekst requestu przeżył granicę renderu — a poza drzewem page/layout
 * (osobna kontynuacja async, cache scope, render dziecka) `next-intl` nie ma
 * czego odziedziczyć i `src/i18n.ts:25` cicho spada na `DEFAULT_LOCALE = 'pl'`.
 * Ta klasa dwukrotnie wywróciła reland PDP (v1.13.0) i jest przyczyną polskiego
 * chrome'u PDP na `/ua`, `/de`, `/en` opisanego w audycie v1.14.0.
 *
 * PODZIAŁ PRACY Z ISTNIEJĄCYMI BRAMKAMI (celowy, nie duplikat):
 *  - `gp/require-set-request-locale` (AD-3, Story 1.3) rządzi ROUTE ENTRIES pod
 *    `src/app/[locale]/**`: tam sankcjonowanym mechanizmem jest
 *    `setRequestLocale(locale)` przed pierwszym kontekstozależnym resolverem.
 *    Dlatego `src/app/**` jest co do zasady POZA zakresem tej reguły — inaczej
 *    dwie bramki wymagałyby dwóch sprzecznych rzeczy na tym samym pliku.
 *    DWA WYJĄTKI, oba wsparte pomiarem, nie założeniem: `getMessages` wszędzie
 *    (patrz `DEFAULT_ROUTE_SCOPED_FNS`) oraz `getTranslations` w plikach
 *    `layout.*` (patrz `DEFAULT_LAYOUT_SCOPED_FNS`) — w obu przypadkach
 *    zmierzono, że `setRequestLocale` NIE wystarcza.
 *  - `gp/locale-cache-boundary` (AD-1, Story 1.2) rządzi reprezentacją locale
 *    w warstwie danych i cache scope.
 *  - TA reguła rządzi GRANICĄ RENDERU w `src/components/**` i `src/lib/**`,
 *    gdzie nie ma gwarancji, w której kontynuacji async kod zostanie wykonany.
 *
 * PODZIAŁ PRACY Z TYPESCRIPTEM (wzorzec QD-01):
 *  - TypeScript gwarantuje, że `locale` JEST w zasięgu (wymagany props/argument
 *    — pokrycia call sites pilnuje typ, nie code review);
 *  - ta reguła gwarantuje, że `locale` został UŻYTY.
 *  Sam props bez reguły to parametr-widmo (QD-01 znalazł taki w seedzie Payload);
 *  sama reguła bez propsa jest spełnialna przez usunięcie locale z komponentu.
 *
 * ZNANE OGRANICZENIA (gate przeciw regresji przez nieuwagę, nie sandbox):
 *  - reguła jest leksykalna/scope'owa: wykrywa BINDING o nazwie z `localeNames`
 *    (parametr, destrukturyzacja, `const`), a nie dostęp `props.locale`;
 *  - nie śledzi, czy wartość `locale` jest poprawna — tylko czy została podana
 *    jawnie do `getTranslations`;
 *  - pomija moduły `"use client"` (tam obowiązuje `useTranslations` z providera)
 *    oraz pliki testowe i Storybook.
 *
 * Cross-ref: CAP-3, ADR-152, ADR-154, `rules/require-set-request-locale.js`.
 * Authored: v1.14.0 QD-03.
 */
"use strict";

/** Zakres: granice renderu POZA route entries (te ma AD-3). */
const DEFAULT_INCLUDE_PATTERNS = ["src/components/", "src/lib/"];
/** Nazwy bindingów uznawanych za „locale jest w zasięgu". */
const DEFAULT_LOCALE_NAMES = ["locale", "localeSlug", "routeLocale"];
/**
 * `getTranslations` — chrome serwerowy. `getMessages` — słownik wstrzykiwany do
 * `NextIntlClientProvider`, czyli locale CAŁEGO poddrzewa klienckiego.
 */
const DEFAULT_TRANSLATION_FNS = ["getTranslations", "getMessages"];
/**
 * `getMessages` jest egzekwowane RÓWNIEŻ w route entries, bo `setRequestLocale`
 * go nie ratuje — zmierzone żywym prod-buildem PDP: `src/app/[locale]/layout.tsx`
 * wołał `getMessages()` linijkę po `setRequestLocale(locale)` i mimo to wysyłał
 * do providera słownik PL na /ua, /de i /en. Cały chrome kliencki leciał po
 * polsku. Dlatego dla tej funkcji nie ma podziału na route entry i komponent.
 */
const DEFAULT_ROUTE_SCOPED_FNS = ["getMessages"];
const DEFAULT_ROUTE_PATTERNS = ["src/app/"];

/**
 * W route entries `getTranslations` jest egzekwowane WYŁĄCZNIE w plikach
 * layoutu — z tego samego powodu, dla którego `getMessages` jest egzekwowane
 * wszędzie: `setRequestLocale` tam nie wystarcza.
 *
 * Zmierzone żywym prod-buildem 2026-08-03 (gp-config BonBeauty, zimny cache):
 * `src/app/[locale]/(main)/layout.tsx` wołał `getTranslations('accessibility')`
 * jedenaście linii po `setRequestLocale(locale)` i renderował POLSKI skip-link
 * na /en, /ua i /de dla PDP, seller-detail i collection — podczas gdy
 * `category` renderowało poprawnie, przy TYM SAMYM layoucie. W tym samym
 * renderze `targetLocale` wynosił już "de-DE", więc `locale` było poprawne;
 * degradował wyłącznie translator. Po przekazaniu `locale` jawnie: zero
 * wystąpień PL na wszystkich trzech powierzchniach, bez regresji na /pl.
 *
 * Dlaczego tylko layout, a nie każdy route entry: translator layoutu zasila
 * chrome opakowujący KAŻDĄ stronę pod nim, więc jeden zły odczyt degraduje
 * całą trasę. `page.tsx` odpowiada za własną treść — tam obowiązuje podział
 * pracy z `gp/require-set-request-locale` i 51 wywołań czeka na osobną
 * migrację (patrz deferred-work).
 */
const DEFAULT_LAYOUT_SCOPED_FNS = ["getTranslations"];
const LAYOUT_FILE_RE = /\/layout\.[cm]?[jt]sx?$/;

function normalizePath(filename) {
  return String(filename || "").split("\\").join("/");
}

function matchesAny(filename, fragments) {
  return fragments.some((fragment) => filename.includes(fragment));
}

function isTestFile(filename) {
  return (
    filename.includes("/__tests__/") ||
    /\.(test|spec|stories)\.[cm]?[jt]sx?$/.test(filename)
  );
}

/** Zdejmuje `await`, `as X`, `satisfies X`, `!`, `<X>expr` — jak w regułach 1.2/1.3. */
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
 * Kontekstozależna forma: brak argumentów albo pierwszy argument nie jest
 * obiektem. `getTranslations({ locale, namespace })` jest deterministyczne
 * i przechodzi. Definicja lustrzana wobec `require-set-request-locale.js`,
 * żeby obie bramki zgadzały się co do tego, co znaczy „forma jawna".
 */
function contextDependentCallee(node, translationFns) {
  if (node.type !== "CallExpression") return null;
  const callee = unwrap(node.callee);
  if (!callee || callee.type !== "Identifier") return null;
  if (!translationFns.includes(callee.name)) return null;
  const firstArg = node.arguments.length > 0 ? unwrap(node.arguments[0]) : null;
  if (firstArg && firstArg.type === "ObjectExpression") return null;
  return callee.name;
}

/** Tekst namespace'u do komunikatu — string literal albo `(dynamiczny)`. */
function describeNamespace(node) {
  const firstArg = node.arguments.length > 0 ? unwrap(node.arguments[0]) : null;
  if (!firstArg) return "(bez argumentu)";
  if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
    return firstArg.value;
  }
  return "(dynamiczny)";
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Wymusza jawne getTranslations({ locale, namespace }) wszędzie tam, gdzie locale jest w zasięgu — poza route entries rządzonymi przez gp/require-set-request-locale.",
    },
    schema: [
      {
        type: "object",
        properties: {
          includePatterns: { type: "array", items: { type: "string" } },
          localeNames: { type: "array", items: { type: "string" } },
          allowlist: { type: "array", items: { type: "string" } },
          translationFns: { type: "array", items: { type: "string" } },
          routeScopedFns: { type: "array", items: { type: "string" } },
          layoutScopedFns: { type: "array", items: { type: "string" } },
          routePatterns: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      implicitLocale:
        "{{fn}}('{{namespace}}') rozwiązuje locale z request store, a `{{binding}}` jest w zasięgu tej funkcji. Poza drzewem page/layout store bywa pusty i next-intl cicho spada na default 'pl'. Użyj {{fn}}({ locale: {{binding}}, … }) (CAP-3, QD-03).",
      implicitLocaleMessages:
        "{{fn}}() bez jawnego locale wstrzykuje słownik do NextIntlClientProvider, a `{{binding}}` jest w zasięgu. setRequestLocale TU NIE WYSTARCZA — zmierzone żywym prod-buildem: PDP wysyłał słownik PL na /ua, /de i /en. Użyj {{fn}}({ locale: {{binding}} }) (CAP-3, QD-03).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const includePatterns = options.includePatterns || DEFAULT_INCLUDE_PATTERNS;
    const localeNames = options.localeNames || DEFAULT_LOCALE_NAMES;
    const allowlist = options.allowlist || [];
    const translationFns = options.translationFns || DEFAULT_TRANSLATION_FNS;
    const routeScopedFns = options.routeScopedFns || DEFAULT_ROUTE_SCOPED_FNS;
    const routePatterns = options.routePatterns || DEFAULT_ROUTE_PATTERNS;
    const layoutScopedFns = options.layoutScopedFns || DEFAULT_LAYOUT_SCOPED_FNS;

    const filename = normalizePath(
      context.filename || (context.getFilename && context.getFilename())
    );

    const inRenderBoundary = matchesAny(filename, includePatterns);
    const inRouteEntry = matchesAny(filename, routePatterns);
    const inRouteLayout = inRouteEntry && LAYOUT_FILE_RE.test(filename);

    if (
      (!inRenderBoundary && !inRouteEntry) ||
      isTestFile(filename) ||
      matchesAny(filename, allowlist)
    ) {
      return {};
    }

    /**
     * W route entries egzekwujemy funkcje z `routeScopedFns` wszędzie,
     * a `layoutScopedFns` dodatkowo w plikach `layout.*` (patrz komentarz przy
     * `DEFAULT_LAYOUT_SCOPED_FNS` — zmierzony defekt skip-linka).
     */
    function isEnforced(fnName) {
      if (inRenderBoundary) return true;
      if (routeScopedFns.includes(fnName)) return true;
      return inRouteLayout && layoutScopedFns.includes(fnName);
    }

    let skipModule = false;
    const sourceCode = context.sourceCode || context.getSourceCode();

    /**
     * Szuka bindingu locale w zasięgu wywołania, idąc w górę łańcucha scope'ów.
     * Zatrzymuje się na scope modułu włącznie — `const locale = …` na poziomie
     * modułu też jest „locale w zasięgu".
     */
    function findLocaleBinding(node) {
      let scope = sourceCode.getScope
        ? sourceCode.getScope(node)
        : context.getScope();
      while (scope) {
        for (const variable of scope.variables) {
          if (localeNames.includes(variable.name) && variable.defs.length > 0) {
            return variable.name;
          }
        }
        scope = scope.upper;
      }
      return null;
    }

    return {
      Program(programNode) {
        skipModule = hasUseClientDirective(programNode);
      },

      CallExpression(node) {
        if (skipModule) return;

        const fnName = contextDependentCallee(node, translationFns);
        if (!fnName || !isEnforced(fnName)) return;

        const binding = findLocaleBinding(node);
        if (!binding) return;

        context.report({
          node,
          messageId:
            fnName === "getMessages" ? "implicitLocaleMessages" : "implicitLocale",
          data: { fn: fnName, namespace: describeNamespace(node), binding },
        });
      },
    };
  },
};
