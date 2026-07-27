/**
 * Rule: gp/i18n-namespace-key-resolves
 *
 * Lint-gate przeciwko DRYFOWI NAMESPACE↔KLUCZ w next-intl.
 *
 * `gp/no-hardcoded-i18n-strings` pilnuje, że tekst idzie przez i18n.
 * `scripts/check-i18n-key-parity.ts` pilnuje, że cztery katalogi locale mają
 * ten sam zbiór kluczy. Żaden z nich nie widzi DRUGIEJ połowy kontraktu:
 * czy namespace otwarty przez `getTranslations('<ns>')` / `useTranslations('<ns>')`
 * faktycznie zawiera klucz, o który komponent następnie prosi.
 *
 * Gdy te dwie rzeczy się rozjadą, klucz nie rozwiązuje się w aktywnym locale.
 * Skutek zależy od środowiska i od tego, ilu katalogów brakuje
 * (`src/lib/i18n/rawKeyGuard.ts`, kaskada fallbacków EN→PL z `src/i18n.ts`):
 *  - dev / preview — `onError` rzuca przy KAŻDYM MISSING_MESSAGE, niezależnie
 *    od fallbacków, więc 500 na CAŁEJ powierzchni nawet dla jednej etykiety,
 *  - produkcja, klucz brakujący w części locale — `getMessageFallback` podstawia
 *    tekst z EN (a potem PL): użytkownik widzi treść w OBCYM języku,
 *  - produkcja, klucz nieobecny we wszystkich katalogach — fallback nie ma z
 *    czego skorzystać i zwraca pusty string: element UI znika bez śladu.
 * Parity tego nie wykryje, bo klucz ISTNIEJE — tylko pod innym namespace.
 *
 * Klasa błędu potwierdzona trzykrotnie w tym repo:
 *  1. checkout — `voucher_delivery_label` czytany z `checkout` zamiast `cart`
 *     (naprawione w `552bb8e7a`),
 *  2. seller hero — `verified_seller` czytany z `products` zamiast `pdp`
 *     (zgłoszenie użytkownika: 500 przy próbie zakupu; ten commit),
 *  3. `/user/vouchers` — `snapshot_email` i `page_intro` nieobecne we
 *     WSZYSTKICH czterech katalogach; wykryte dopiero przez tę regułę, klucze
 *     dodane w tym samym commicie.
 *
 * DLACZEGO AST, A NIE SKAN TEKSTOWY: pierwsze podejście do tego gate'u było
 * regexem sumującym wszystkie namespace zadeklarowane w pliku. Adversarial
 * review wykazał, że taki wariant NIE chroniłby nawet pliku, który właśnie
 * naprawia (po fixie plik deklaruje `pdp`, więc powrót `pdpT(` → `t(` przechodzi
 * na zielono), pomijał 50 bindingów w konwencji `tCart`/`tCommon` oraz 37 plików
 * w formie obiektowej. Analiza wiązań przez scope ESLint zamyka wszystkie trzy
 * dziury naraz i nie zależy od konwencji nazewniczej.
 *
 * Co reguła egzekwuje:
 *  (a) klucz literalny podany translatorowi rozwiązuje się w namespace TEGO
 *      KONKRETNEGO wiązania — rozstrzyganego przez scope, nie przez nazwę;
 *  (b) rozwiązuje się do LIŚCIA (stringa). Trafienie w węzeł-obiekt to runtime
 *      `INSUFFICIENT_PATH` — next-intl NIE renderuje wtedy tekstu. To inny błąd
 *      niż MISSING_MESSAGE (rawKeyGuard przepuszcza go jako warning, nie throw),
 *      ale wciąż niedziałająca etykieta, więc gate go łapie;
 *  (c) rozwiązuje się we WSZYSTKICH skonfigurowanych katalogach locale.
 *
 * Obsługiwane kształty wiązań:
 *  - `const t = useTranslations('ns')` / `const t = await getTranslations('ns')`
 *  - forma obiektowa `getTranslations({ locale, namespace: 'ns' })`
 *  - root translator bez argumentu — klucze rozwiązywane od korzenia katalogu
 *  - destrukturyzacja `const [t, sharedT] = await Promise.all([...])`
 *  - `as`/`!`/`satisfies` wokół wywołania fabryki, wywołanie opcjonalne `?.()`
 *  - aliasy importu (`import { getTranslations as gt } from 'next-intl/server'`)
 *  - `t.rich(…)`, `t.markup(…)`, `t.raw(…)`, także w formie `t['raw'](…)`.
 *    `t.has(…)` jest CELOWO pominięte — to probe istnienia klucza, jego sensem
 *    jest zwrócić `false`.
 *
 * ZNANE LUKI (świadome, udokumentowane — nie „reguła to pokrywa"):
 *  - Translator PRZEKAZANY jako parametr/prop (`function Form({ tAuth })`,
 *    `buildSections(tHome)`) nie ma wiązania w tym module, więc jego klucze są
 *    pomijane. To ~230 wywołań, m.in. `AuthForms.tsx`, `AccountLayout.tsx`,
 *    `RegisterForm/schema.ts`. Domknięcie wymaga analizy międzymodułowej
 *    (kto woła funkcję i z jakim namespace) — poza zakresem reguły lintowej.
 *  - Klucze dynamiczne (`t(key)`, `t(`errors.${code}`)`) i namespace dynamiczny:
 *    wiązanie jest oznaczane jako nierozstrzygalne i jego klucze są pomijane,
 *    zamiast produkować fałszywe alarmy.
 *  - Translator reassignowany (`let t = …; t = …`) — jw., pomijany.
 *  - Re-eksport fabryki z lokalnego modułu (`import { getTranslations } from
 *    '@/lib/i18n-wrapper'`) jest traktowany jak lokalny helper, więc wyłącza
 *    gate dla tego pliku. To cena rozpoznawania lokalnych helperów o kolidującej
 *    nazwie; gdyby taki wrapper kiedykolwiek powstał, trzeba dopisać jego
 *    ścieżkę do `NEXT_INTL_SOURCES`, inaczej cicho stanie się furtką.
 *
 * Cross-ref: `src/lib/i18n/rawKeyGuard.ts`, `src/lib/i18n/keyParity.ts`,
 * `scripts/check-i18n-key-parity.ts`.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_FACTORY_NAMES = ["useTranslations", "getTranslations"];
const NEXT_INTL_SOURCES = /^next-intl(\/|$)/;
/** Metody translatora, które nie renderują tekstu przy braku klucza (`has` NIE). */
const THROWING_METHODS = new Set(["rich", "markup", "raw"]);
const DEFAULT_LOCALES = ["pl", "en", "ua", "de"];

/** Wiązanie, którego namespace jest dynamiczny — klucze pomijamy. */
const UNRESOLVABLE = Symbol("unresolvable-namespace");

/**
 * Cache katalogów: JEDEN wpis na `messagesDir`, nadpisywany gdy zmieni się
 * stempel mtime/rozmiar. Wariant „wpis na stempel" rósłby bez ograniczeń —
 * cztery katalogi to ~690 KB JSON-a, a w eslint_d / serwerze ESLint w VS Code
 * (czyli tam, gdzie stemplowanie w ogóle jest potrzebne) każdy zapis pliku
 * tłumaczeń zostawiałby kolejną kopię grafu w pamięci.
 */
const catalogCache = new Map();

/** Katalogi, dla których zgłoszono już awarię wczytywania (patrz `reportOnce`). */
const reportedCatalogFailures = new Set();

function loadCatalogs(messagesDir, locales) {
  const stamps = [];
  const files = [];

  for (const locale of locales) {
    const file = path.join(messagesDir, `${locale}.json`);
    files.push({ locale, file });
    try {
      const stat = fs.statSync(file);
      stamps.push(`${locale}:${stat.mtimeMs}:${stat.size}`);
    } catch {
      stamps.push(`${locale}:missing`);
    }
  }

  const stamp = stamps.join("|");
  const cached = catalogCache.get(messagesDir);
  if (cached && cached.stamp === stamp) {
    return cached;
  }

  const catalogs = [];
  const failed = [];

  for (const { locale, file } of files) {
    try {
      catalogs.push({ locale, messages: JSON.parse(fs.readFileSync(file, "utf-8")) });
    } catch {
      failed.push(locale);
    }
  }

  const result = { stamp, catalogs, failed };
  catalogCache.set(messagesDir, result);
  // Zmiana zawartości to nowa szansa na zgłoszenie — inaczej naprawiony i
  // ponownie zepsuty katalog milczałby do końca życia procesu.
  reportedCatalogFailures.delete(messagesDir);
  return result;
}

/** @returns {"leaf"|"branch"|"missing"} */
function classifyKey(messages, namespace, key) {
  const segments = [...(namespace ? namespace.split(".") : []), ...key.split(".")];
  let node = messages;

  // Pusty segment (`t('')`, `useTranslations('pdp.')`) nigdy nie jest kluczem
  // katalogu — rozstrzygamy od razu, żeby nie produkować komunikatu o pustej
  // nazwie klucza.
  if (segments.some((segment) => segment === "")) {
    return "missing";
  }

  for (const segment of segments) {
    if (
      typeof node !== "object" ||
      node === null ||
      !Object.prototype.hasOwnProperty.call(node, segment)
    ) {
      return "missing";
    }
    node = node[segment];
  }

  return typeof node === "string" ? "leaf" : "branch";
}

/** Zdejmuje warstwy, które nie zmieniają wartości wyrażenia. */
function unwrap(node) {
  let current = node;

  for (;;) {
    if (!current) {
      return current;
    }

    switch (current.type) {
      case "AwaitExpression":
        current = current.argument;
        break;
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "ChainExpression":
        current = current.expression;
        break;
      default:
        return current;
    }
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Klucz i18n musi rozwiązywać się do stringa w namespace swojego wiązania, we wszystkich locale.",
    },
    schema: [
      {
        type: "object",
        properties: {
          messagesDir: { type: "string" },
          locales: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unresolvedKey:
        "i18n: `{{key}}` nie istnieje w namespace `{{namespace}}` w ŻADNYM katalogu ({{locales}}). Skutek: 500 w dev/preview (rawKeyGuard rzuca) i pusty element na produkcji — kaskada fallbacków EN→PL nie ma z czego skorzystać.",
      unresolvedKeyPartial:
        "i18n: `{{key}}` nie istnieje w namespace `{{namespace}}` w locale: {{locales}}. Skutek: 500 w dev/preview przy tych locale; na produkcji fallback pokaże tekst z EN/PL, czyli w obcym języku.",
      nonLeafKey:
        "i18n: `{{key}}` w namespace `{{namespace}}` wskazuje na grupę kluczy, nie na tekst (locale: {{locales}}). next-intl zgłosi INSUFFICIENT_PATH i nie wyrenderuje etykiety.",
      catalogsUnavailable:
        "i18n: nie udało się wczytać ŻADNEGO katalogu locale z `{{dir}}` — gate namespace↔klucz nie działa. Sprawdź opcję `messagesDir` reguły gp/i18n-namespace-key-resolves.",
      catalogsIncomplete:
        "i18n: nie udało się wczytać katalogów locale: {{locales}} (z `{{dir}}`). Gate sprawdza tylko pozostałe, więc dryf w brakujących locale przejdzie niezauważony.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const locales = options.locales || DEFAULT_LOCALES;
    // UWAGA: ta ścieżka zakłada, że `node_modules/eslint-plugin-gp` jest
    // SYMLINKIEM do źródła — dlatego `package.json` deklaruje plugin jako
    // `link:./eslint-plugin-gp`, a nie `file:`. Przy `file:` pnpm materializuje
    // kopię w wirtualnym store, `__dirname` wskazuje w głąb store'u i `../../messages`
    // nie istnieje: gate zgłasza wtedy `catalogsUnavailable` na całym repo.
    // Zmiana protokołu z powrotem na `file:` wyłącza tę regułę.
    const messagesDir = options.messagesDir || path.resolve(__dirname, "../../messages");
    const { catalogs, failed } = loadCatalogs(messagesDir, locales);

    const sourceCode = context.sourceCode || context.getSourceCode();

    // Fail-loud zamiast fail-open: gdy katalogów nie ma, gate przestaje cokolwiek
    // sprawdzać. Cicha zielona lampka jest tu groźniejsza niż czerwona — ale
    // zgłaszamy RAZ, nie na każdym z ~930 plików, żeby przyczyna nie utonęła.
    if (catalogs.length === 0) {
      return {
        Program(node) {
          if (reportedCatalogFailures.has(messagesDir)) {
            return;
          }
          reportedCatalogFailures.add(messagesDir);
          context.report({
            node,
            messageId: "catalogsUnavailable",
            data: { dir: messagesDir },
          });
        },
      };
    }

    /** @type {Array<{variable: object, namespace: string|symbol}>} */
    const bindings = [];
    /** Deklaratory zebrane w trakcie obchodu; rozstrzygane w `Program:exit`. */
    const declarators = [];
    /** Przypisania do zmiennych — czynią wiązanie nierozstrzygalnym. */
    const assignments = [];
    /** @type {Array<{node: object, identifier: object, key: string}>} */
    const calls = [];
    /** Lokalne nazwy fabryk next-intl (z uwzględnieniem aliasów importu). */
    const factoryNames = new Set(DEFAULT_FACTORY_NAMES);
    /** Nazwy przesłonięte importem z INNEGO modułu — to nie są fabryki next-intl. */
    const shadowedFactoryNames = new Set();

    function isFactoryCall(node) {
      return (
        node &&
        node.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        factoryNames.has(node.callee.name) &&
        !shadowedFactoryNames.has(node.callee.name)
      );
    }

    /**
     * Namespace otwierany przez wywołanie fabryki.
     * @returns {string|UNRESOLVABLE|null} `null` gdy to nie jest wywołanie fabryki.
     */
    function namespaceOf(node) {
      const call = unwrap(node);
      if (!isFactoryCall(call)) {
        return null;
      }

      const [arg] = call.arguments;

      // `useTranslations()` — translator zakotwiczony w korzeniu katalogu.
      if (!arg) {
        return "";
      }

      if (arg.type === "Literal" && typeof arg.value === "string") {
        return arg.value;
      }

      if (arg.type === "ObjectExpression") {
        // Spread albo klucz obliczany może wnieść `namespace`, którego nie
        // widzimy — traktowanie takiego obiektu jako „bez namespace" (root)
        // zamieniałoby poprawny kod w twardy błąd.
        const opaque = arg.properties.some(
          (property) => property.type === "SpreadElement" || property.computed
        );
        if (opaque) {
          return UNRESOLVABLE;
        }

        const property = arg.properties.find(
          (candidate) =>
            candidate.type === "Property" &&
            (candidate.key.name === "namespace" || candidate.key.value === "namespace")
        );

        if (!property) {
          // `getTranslations({ locale })` — bez namespace, czyli korzeń.
          return "";
        }

        return property.value.type === "Literal" && typeof property.value.value === "string"
          ? property.value.value
          : UNRESOLVABLE;
      }

      return UNRESOLVABLE;
    }

    /** Klucz literalny z pierwszego argumentu wywołania translatora. */
    function literalKeyOf(node) {
      const [arg] = node.arguments;

      if (arg && arg.type === "Literal" && typeof arg.value === "string") {
        return arg.value;
      }

      // Template bez interpolacji jest statyczny i zdarza się w praktyce.
      if (arg && arg.type === "TemplateLiteral" && arg.expressions.length === 0) {
        return arg.quasis[0].value.cooked;
      }

      return null;
    }

    function bindDeclarator(node) {
      const declared = sourceCode.getDeclaredVariables(node);
      if (declared.length === 0) {
        return;
      }

      const init = unwrap(node.init);

      // `const [t, sharedT] = await Promise.all([getTranslations(a), …])`
      const isPromiseAll =
        node.id.type === "ArrayPattern" &&
        init &&
        init.type === "CallExpression" &&
        init.callee.type === "MemberExpression" &&
        init.callee.object.name === "Promise" &&
        init.callee.property.name === "all" &&
        init.arguments[0] &&
        init.arguments[0].type === "ArrayExpression";

      if (isPromiseAll) {
        const factories = init.arguments[0].elements;

        node.id.elements.forEach((element, index) => {
          if (!element || element.type !== "Identifier") {
            return;
          }

          const namespace = namespaceOf(factories[index]);
          if (namespace === null) {
            return;
          }

          const variable = declared.find((candidate) => candidate.name === element.name);
          if (variable) {
            bindings.push({ variable, namespace });
          }
        });

        return;
      }

      if (node.id.type !== "Identifier") {
        return;
      }

      const namespace = namespaceOf(node.init);
      if (namespace === null) {
        return;
      }

      bindings.push({ variable: declared[0], namespace });
    }

    function report(entry, namespace) {
      const missing = [];
      const branch = [];

      for (const catalog of catalogs) {
        const verdict = classifyKey(catalog.messages, namespace, entry.key);
        if (verdict === "missing") {
          missing.push(catalog.locale);
        } else if (verdict === "branch") {
          branch.push(catalog.locale);
        }
      }

      // Obie klasy raportowane niezależnie: gdy klucz jest grupą w `pl`, a w
      // `de` go nie ma, jedna naprawa nie powinna odsłaniać drugiego błędu
      // dopiero przy kolejnym przebiegu.
      if (missing.length > 0) {
        context.report({
          node: entry.node,
          // Brak we WSZYSTKICH katalogach i brak w części to różne awarie
          // produkcyjne (pusty element vs tekst w obcym języku) — komunikat
          // musi je rozróżniać, bo od tego zależy triage.
          messageId:
            missing.length === catalogs.length ? "unresolvedKey" : "unresolvedKeyPartial",
          data: { key: entry.key, namespace: namespace || "(root)", locales: missing.join(", ") },
        });
      }

      if (branch.length > 0) {
        context.report({
          node: entry.node,
          messageId: "nonLeafKey",
          data: { key: entry.key, namespace: namespace || "(root)", locales: branch.join(", ") },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        const fromNextIntl = NEXT_INTL_SOURCES.test(node.source.value);

        for (const specifier of node.specifiers) {
          const localName = specifier.local.name;

          if (fromNextIntl) {
            // Alias nazwanego importu (`getTranslations as gt`) rozszerza zbiór
            // fabryk. Import domyślny/gwiazdkowy z next-intl nie wnosi fabryki
            // wołanej jako goły identyfikator, więc go pomijamy.
            if (
              specifier.type === "ImportSpecifier" &&
              DEFAULT_FACTORY_NAMES.includes(specifier.imported.name)
            ) {
              factoryNames.add(localName);
              shadowedFactoryNames.delete(localName);
            }
            continue;
          }

          // Nazwa fabryki związana importem skądinąd to lokalny helper, nie
          // next-intl — dotyczy TAKŻE importu domyślnego i gwiazdkowego
          // (`import getTranslations from './helper'`), inaczej zwykły kod
          // dostaje twardy błąd lintu.
          if (DEFAULT_FACTORY_NAMES.includes(localName)) {
            shadowedFactoryNames.add(localName);
          }
        }
      },

      // `const { useTranslations } = require('@/local')` — w plikach CJS
      // (skrypty, configi) to normalny idiom, a bez tego lokalny helper
      // o kolidującej nazwie byłby brany za fabrykę next-intl.
      "VariableDeclarator > CallExpression[callee.name='require']"(node) {
        const declarator = node.parent;
        const source = node.arguments[0];
        const fromNextIntl =
          source && source.type === "Literal" && NEXT_INTL_SOURCES.test(String(source.value));

        if (fromNextIntl) {
          return;
        }

        for (const variable of sourceCode.getDeclaredVariables(declarator)) {
          if (DEFAULT_FACTORY_NAMES.includes(variable.name)) {
            shadowedFactoryNames.add(variable.name);
          }
        }
      },

      VariableDeclarator(node) {
        // Namespace rozstrzygamy dopiero w `Program:exit`: ESLint obchodzi
        // drzewo w kolejności źródłowej, więc import przesłaniający nazwę
        // fabryki może wystąpić PO deklaracji translatora. Rozstrzyganie tutaj
        // czytałoby jeszcze niekompletny zbiór `shadowedFactoryNames`.
        declarators.push(node);
      },

      // Reassignment czyni wiązanie nierozstrzygalnym — inaczej wszystkie
      // referencje dostałyby namespace pierwszej deklaracji.
      AssignmentExpression(node) {
        if (node.left.type === "Identifier") {
          assignments.push(node);
        }
      },

      CallExpression(node) {
        let identifier = null;

        if (node.callee.type === "Identifier") {
          identifier = node.callee;
        } else if (node.callee.type === "MemberExpression") {
          const property = node.callee.property;
          const methodName = node.callee.computed
            ? property.type === "Literal"
              ? property.value
              : null
            : property.name;

          if (
            THROWING_METHODS.has(methodName) &&
            node.callee.object.type === "Identifier"
          ) {
            identifier = node.callee.object;
          }
        }

        if (!identifier) {
          return;
        }

        const key = literalKeyOf(node);
        if (key === null) {
          return;
        }

        calls.push({ node, identifier, key });
      },

      "Program:exit"(programNode) {
        if (failed.length > 0) {
          context.report({
            node: programNode,
            messageId: "catalogsIncomplete",
            data: { dir: messagesDir, locales: failed.join(", ") },
          });
        }

        // Dopiero teraz zbiór fabryk i przesłonięć jest kompletny, więc
        // rozstrzygamy namespace każdej deklaracji.
        for (const declarator of declarators) {
          bindDeclarator(declarator);
        }

        // Każde przypisanie do zmiennej z wiązaniem unieważnia je — bez względu
        // na kolejność źródłową (zapis do hoistowanego `var` może poprzedzać
        // jego deklarację).
        for (const assignment of assignments) {
          const scope = sourceCode.getScope
            ? sourceCode.getScope(assignment)
            : context.getScope();

          for (let current = scope; current; current = current.upper) {
            const variable = current.variables.find(
              (candidate) => candidate.name === assignment.left.name
            );
            if (variable) {
              bindings.push({ variable, namespace: UNRESOLVABLE });
              break;
            }
          }
        }

        // Wiązania rozstrzygamy dopiero tu: referencje zmiennych są kompletne
        // po przejściu całego modułu, a to ESLint — nie konwencja nazewnicza —
        // wie, do której deklaracji należy dany identyfikator.
        const namespaceByIdentifier = new Map();
        const unresolvable = new Set();

        for (const { variable, namespace } of bindings) {
          if (namespace === UNRESOLVABLE) {
            unresolvable.add(variable);
          }
        }

        for (const { variable, namespace } of bindings) {
          if (unresolvable.has(variable)) {
            continue;
          }

          for (const reference of variable.references) {
            // Wielokrotna deklaracja tej samej (hoistowanej) zmiennej z różnymi
            // namespace jest nierozstrzygalna leksykalnie — nie zgadujemy.
            if (
              namespaceByIdentifier.has(reference.identifier) &&
              namespaceByIdentifier.get(reference.identifier) !== namespace
            ) {
              namespaceByIdentifier.set(reference.identifier, UNRESOLVABLE);
              continue;
            }
            namespaceByIdentifier.set(reference.identifier, namespace);
          }
        }

        for (const entry of calls) {
          const namespace = namespaceByIdentifier.get(entry.identifier);

          if (namespace === undefined || namespace === UNRESOLVABLE) {
            continue;
          }

          report(entry, namespace);
        }
      },
    };
  },
};
