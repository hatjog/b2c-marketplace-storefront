/**
 * Tests for gp/i18n-namespace-key-resolves.
 *
 * Run via: `pnpm test:eslint-rules` (albo bezpośrednio
 * `node --test eslint-plugin-gp/rules/__tests__/i18n-namespace-key-resolves.test.js`).
 *
 * Test dowodzi EGZEKWOWALNOŚCI, nie obecności pliku:
 *  - sekcja `invalid` zawiera dosłowny kształt wszystkich trzech incydentów,
 *    które reguła ma blokować,
 *  - sekcja `valid` — kształty wiązań, na których wcześniejszy skan tekstowy
 *    produkował fałszywe alarmy, plus konstrukcje TS mogące uciec gate'owi,
 *  - blok na dole sprawdza REALNE katalogi `messages/` ORAZ domyślną ścieżkę
 *    `messagesDir` (tę, której faktycznie używa `.eslintrc.js`, bo nie podaje
 *    żadnych opcji). Bez tego reguła zwracająca zawsze `[]` — albo przeniesiona
 *    do innego katalogu — przechodziłaby wszystkie przypadki powyżej.
 *
 * Katalogi testowe są FIXTUREM NA DYSKU, nie opcją reguły: gdyby dało się
 * wstrzyknąć katalog przez konfigurację, ten sam mechanizm pozwalałby wyłączyć
 * gate inline (`/* eslint gp/…: ["error", {"catalogs": {...}}] *\/`) w kodzie
 * produkcyjnym, zostawiając regułę pozornie włączoną.
 */
"use strict";

const assert = require("node:assert");
const path = require("node:path");
const { describe, it } = require("node:test");

const { Linter, RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");

const rule = require("../i18n-namespace-key-resolves");

const FIXTURE_DIR = path.join(__dirname, "fixtures/messages");
const PARTIAL_FIXTURE_DIR = path.join(__dirname, "fixtures/messages-partial");
const DIVERGENT_FIXTURE_DIR = path.join(__dirname, "fixtures/messages-divergent");
const REAL_MESSAGES_DIR = path.resolve(__dirname, "../../../messages");

// Bez tego RuleTester nie widzi runnera `node:test`, spada na własny fallback
// i RZUCA na pierwszym niezdanym przypadku — przerywając ewaluację modułu,
// zanim zarejestruje się blok `describe` poniżej. Efekt: jedna regresja
// ukrywała wszystkie testy na realnych katalogach, a `pnpm test:eslint-rules`
// raportował garstkę testów zamiast pełnego zestawu.
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  },
});

const options = [{ messagesDir: FIXTURE_DIR }];

ruleTester.run("gp/i18n-namespace-key-resolves", rule, {
  valid: [
    {
      name: "klucz istnieje w namespace swojego wiązania",
      code: `const t = await getTranslations('pdp'); t('verified_seller');`,
      options,
    },
    {
      name: "wiele wiązań w jednym pliku — każde rozstrzygane osobno",
      code: `
        const t = await getTranslations('products');
        const pdpT = await getTranslations('pdp');
        t('add_to_cart');
        pdpT('verified_seller');
      `,
      options,
    },
    {
      name: "destrukturyzacja z Promise.all (kształt, na którym skan tekstowy dawał fałszywki)",
      code: `
        const [t, sharedT] = await Promise.all([
          getTranslations('products'),
          getTranslations('seller.shared'),
        ]);
        t('add_to_cart');
        sharedT('breadcrumb_home');
      `,
      options,
    },
    {
      name: "forma obiektowa getTranslations({ locale, namespace })",
      code: `const t = await getTranslations({ locale, namespace: 'cart' }); t('voucher_delivery_label');`,
      options,
    },
    {
      name: "root translator — klucze rozwiązywane od korzenia katalogu",
      code: `const t = useTranslations(); t('pdp.verified_seller');`,
      options,
    },
    {
      name: "klucz zagnieżdżony rozwiązany do liścia",
      code: `const t = useTranslations('pdp.tabs'); t('salon.address');`,
      options,
    },
    {
      name: "t.rich / t.markup / t.raw z poprawnym kluczem",
      code: `
        const t = useTranslations('pdp');
        t.rich('verified_seller');
        t.markup('verified_seller');
        t.raw('verified_seller');
      `,
      options,
    },
    {
      name: "t.has celowo pominięte — probe istnienia ma prawo zwrócić false",
      code: `const t = useTranslations('pdp'); t.has('nie_istnieje');`,
      options,
    },
    {
      name: "klucz dynamiczny pominięty zamiast fałszywego alarmu",
      code: "const t = useTranslations('pdp'); t(key); t(`errors.${code}`);",
      options,
    },
    {
      name: "namespace dynamiczny czyni wiązanie nierozstrzygalnym",
      code: `const t = useTranslations(nsFromProps); t('cokolwiek');`,
      options,
    },
    {
      name: "spread w opcjach — namespace może przyjść z rozwinięcia, nie zgadujemy roota",
      code: `const t = await getTranslations({ locale, ...rest }); t('verified_seller');`,
      options,
    },
    {
      name: "klucz obliczany w opcjach — jw.",
      code: `const t = await getTranslations({ ['namespace']: ns }); t('verified_seller');`,
      options,
    },
    {
      name: "reassignment translatora czyni wiązanie nierozstrzygalnym",
      code: `let t = useTranslations('products'); t = useTranslations('pdp'); t('verified_seller');`,
      options,
    },
    {
      name: "sprzeczne deklaracje hoistowanej zmiennej — nie zgadujemy gałęzi",
      code: `
        if (a) { var t = useTranslations('pdp'); } else { var t = useTranslations('products'); }
        t('verified_seller');
      `,
      options,
    },
    {
      name: "shadowing — wewnętrzne wiązanie nie dziedziczy namespace zewnętrznego",
      code: `
        const t = useTranslations('products');
        function inner() {
          const t = useTranslations('pdp');
          return t('verified_seller');
        }
      `,
      options,
    },
    {
      name: "translator przekazany jako parametr — brak wiązania, świadomie pomijany",
      code: `function Form({ tAuth }) { return tAuth('cokolwiek.czego.nie.ma'); }`,
      options,
    },
    {
      name: "identyfikator niebędący translatorem jest ignorowany",
      code: `const format = (x) => x; format('nie.jest.kluczem');`,
      options,
    },
    {
      name: "lokalny helper o nazwie useTranslations nie jest fabryką next-intl",
      code: `
        import { useTranslations } from '@/lib/local-helper';
        const t = useTranslations('products');
        t('verified_seller');
      `,
      options,
    },
    {
      name: "import DOMYŚLNY o nazwie fabryki też przesłania",
      code: `
        import getTranslations from '@/lib/local-helper';
        const t = getTranslations('products');
        t('verified_seller');
      `,
      options,
    },
    {
      name: "import GWIAZDKOWY o nazwie fabryki też przesłania",
      code: `
        import * as useTranslations from '@/lib/local-helper';
        const t = useTranslations('products');
        t('verified_seller');
      `,
      options,
    },
    {
      name: "require() lokalnego helpera przesłania (idiom plików CJS)",
      code: `
        const { useTranslations } = require('@/lib/local-helper');
        const t = useTranslations('products');
        t('verified_seller');
      `,
      options,
    },
    {
      name: "import przesłaniający PO deklaracji translatora (kolejność źródłowa)",
      code: `
        const t = useTranslations('products');
        import { useTranslations } from '@/lib/local-helper';
        t('verified_seller');
      `,
      options,
    },
    {
      name: "zapis do hoistowanego var PRZED jego deklaracją unieważnia wiązanie",
      code: `
        function f() { t = useTranslations('pdp'); }
        var t = useTranslations('products');
        t('verified_seller');
      `,
      options,
    },
    {
      name: "pusty klucz nie wywraca reguły",
      code: `const t = useTranslations('pdp'); t.has('');`,
      options,
    },
  ],

  invalid: [
    {
      name: "INCYDENT 2: verified_seller czytany z products zamiast pdp",
      code: `const t = await getTranslations('products'); t('verified_seller');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "INCYDENT 1: voucher_delivery_label czytany z checkout zamiast cart",
      code: `const tCheckout = await getTranslations('checkout'); tCheckout('voucher_delivery_label');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "konwencja nazewnicza tPrefix — niewidoczna dla skanu opartego o nazwy",
      code: `const tCart = useTranslations('cart'); tCart('pay');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "forma obiektowa też jest sprawdzana (37 plików pomijanych przez skan tekstowy)",
      code: `const t = await getTranslations({ locale, namespace: 'checkout' }); t('voucher_delivery_label');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "sąsiedztwo poprawnego wiązania NIE usprawiedliwia złego (dziura reguły unii)",
      code: `
        const t = await getTranslations('products');
        const pdpT = await getTranslations('pdp');
        t('verified_seller');
      `,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "klucz wskazujący na grupę, nie na tekst",
      code: `const t = useTranslations('pdp'); t('tabs');`,
      options,
      errors: [{ messageId: "nonLeafKey" }],
    },
    {
      name: "klucz z prototypu Object nie jest kluczem katalogu",
      code: `const t = useTranslations('pdp'); t('constructor');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "t.raw rzuca tak samo jak t",
      code: `const t = useTranslations('pdp'); t.raw('nie_istnieje');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "t['raw'] — forma obliczana nie jest obejściem",
      code: `const t = useTranslations('pdp'); t['raw']('nie_istnieje');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "asercja typu nie jest obejściem",
      code: `const t = (await getTranslations('products')) as any; t('verified_seller');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "non-null assertion nie jest obejściem",
      code: `const t = (await getTranslations('products'))!; t('verified_seller');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "wywołanie opcjonalne fabryki nie jest obejściem",
      code: `const t = useTranslations?.('products'); t('verified_seller');`,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "alias importu fabryki jest rozpoznawany",
      code: `
        import { getTranslations as gt } from 'next-intl/server';
        const t = await gt('products');
        t('verified_seller');
      `,
      options,
      errors: [{ messageId: "unresolvedKey" }],
    },
    {
      name: "brak katalogów = gate nie działa; raportujemy zamiast milczeć",
      code: `const t = useTranslations('pdp'); t('verified_seller');`,
      options: [{ messagesDir: path.join(__dirname, "fixtures/nie-istnieje") }],
      errors: [{ messageId: "catalogsUnavailable" }],
    },
    {
      name: "częściowa utrata locale jest zgłaszana, nie przemilczana",
      code: `const t = useTranslations('pdp'); t('verified_seller');`,
      options: [{ messagesDir: PARTIAL_FIXTURE_DIR }],
      errors: [{ messageId: "catalogsIncomplete" }],
    },
    {
      name: "obie klasy werdyktu w JEDNYM przebiegu: grupa w pl, brak w de",
      code: `const t = useTranslations('pdp'); t('tabs');`,
      options: [{ messagesDir: DIVERGENT_FIXTURE_DIR, locales: ["pl", "de"] }],
      errors: [
        { messageId: "unresolvedKeyPartial", data: { key: "tabs", namespace: "pdp", locales: "de" } },
        { messageId: "nonLeafKey", data: { key: "tabs", namespace: "pdp", locales: "pl" } },
      ],
    },
    {
      name: "brak w CZĘŚCI locale ma inny komunikat niż brak wszędzie",
      // `tabs.salon.address` jest liściem w pl, a w de nie ma go wcale.
      code: `const t = useTranslations('pdp'); t('tabs.salon.address');`,
      options: [{ messagesDir: DIVERGENT_FIXTURE_DIR, locales: ["pl", "de"] }],
      errors: [
        {
          messageId: "unresolvedKeyPartial",
          data: { key: "tabs.salon.address", namespace: "pdp", locales: "de" },
        },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Kontrola na REALNYCH katalogach messages/*.json — w tym na DOMYŚLNEJ ścieżce
// (bez opcji), czyli dokładnie w konfiguracji używanej przez .eslintrc.js.
// ---------------------------------------------------------------------------

function lint(code, ruleOptions) {
  const linter = new Linter();
  return linter.verify(code, {
    plugins: { gp: { rules: { "i18n-namespace-key-resolves": rule } } },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    rules: {
      "gp/i18n-namespace-key-resolves": ruleOptions ? ["error", ruleOptions] : "error",
    },
  });
}

describe("gate na realnych katalogach messages/", () => {
  it("działa BEZ opcji — domyślny messagesDir wskazuje na istniejące katalogi", () => {
    // Gdyby domyślna ścieżka była błędna (np. po przeniesieniu pliku reguły),
    // reguła zgłosiłaby catalogsUnavailable zamiast sprawdzać cokolwiek.
    const messages = lint(`const t = await getTranslations('pdp'); t('verified_seller');`);

    assert.deepEqual(messages, []);
  });

  it("odrzuca pre-fix SellerPageHeader (verified_seller z namespace products)", () => {
    const messages = lint(`const t = await getTranslations('products'); t('verified_seller');`);

    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /verified_seller/);
  });

  it("przepuszcza post-fix SellerPageHeader (verified_seller z namespace pdp)", () => {
    const messages = lint(
      `const t = await getTranslations('products');
       const pdpT = await getTranslations('pdp');
       pdpT('verified_seller');
       t('seller_reviews');`
    );

    assert.deepEqual(messages, []);
  });

  it("INCYDENT 3: klucze /user/vouchers są obecne w katalogach", () => {
    // Regresja pod klucze dodane w tym samym commicie — bez nich strona
    // `/user/vouchers` przewracała się tak samo jak seller hero.
    const messages = lint(
      `const t = await getTranslations({ locale, namespace: 'account.vouchers' });
       t('snapshot_email');
       t('page_intro');
       t('title');`
    );

    assert.deepEqual(messages, []);
  });

  it("realne katalogi faktycznie się wczytały (gate nie jest cicho pusty)", () => {
    const messages = lint(
      `const t = await getTranslations('pdp'); t('na_pewno_nie_istnieje_klucz_kontrolny');`
    );

    assert.equal(messages.length, 1);
    assert.equal(messages[0].messageId, "unresolvedKey");
  });

  it("sprawdza wszystkie cztery locale, nie tylko pl", () => {
    const messages = lint(`const t = useTranslations('pdp'); t('verified_seller');`, {
      messagesDir: REAL_MESSAGES_DIR,
      locales: ["pl", "en", "ua", "de"],
    });

    assert.deepEqual(messages, []);
  });
});
