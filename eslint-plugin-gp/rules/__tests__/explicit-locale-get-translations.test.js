/**
 * Tests for gp/explicit-locale-get-translations (v1.14.0 QD-03, CAP-3).
 *
 * Run via: `pnpm test:eslint-rules` (albo bezpośrednio
 * `node eslint-plugin-gp/rules/__tests__/explicit-locale-get-translations.test.js`).
 *
 * Test dowodzi EGZEKWOWALNOŚCI, nie obecności pliku: sekcja `invalid` zawiera
 * dokładnie te kształty, które wywróciły PDP (locale w propsach + skrócone
 * `getTranslations('pdp')`), a sekcja `valid` — kształty, których reguła NIE
 * MOŻE ruszać, żeby nie wejść w konflikt z `gp/require-set-request-locale`
 * (route entries) ani z providerem klienckim (`"use client"`).
 */
"use strict";

const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../explicit-locale-get-translations");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
});

const PDP_COMPONENT =
  "/repo/GP/storefront/src/components/sections/ProductDetailsPage/ProductDetailsPage.tsx";
const LIB_FILE = "/repo/GP/storefront/src/lib/helpers/seo.ts";
const ROUTE_FILE =
  "/repo/GP/storefront/src/app/[locale]/(main)/products/[handle]/page.tsx";
const LOCALE_LAYOUT = "/repo/GP/storefront/src/app/[locale]/layout.tsx";
const TEST_FILE =
  "/repo/GP/storefront/src/components/sections/__tests__/ProductDetailsPage.test.tsx";

ruleTester.run("gp/explicit-locale-get-translations", rule, {
  valid: [
    // Forma jawna — cel reguły.
    {
      filename: PDP_COMPONENT,
      code: `
        export const Page = async ({ locale }: { locale: string }) => {
          const t = await getTranslations({ locale, namespace: 'pdp' });
          return t('x');
        };
      `,
    },
    // Brak locale w zasięgu — reguła nie zmyśla źródła locale.
    {
      filename: PDP_COMPONENT,
      code: `
        export const Panel = async ({ handle }: { handle: string }) => {
          const t = await getTranslations('pdp');
          return t(handle);
        };
      `,
    },
    // Route entry + getTranslations — rządzi nim gp/require-set-request-locale.
    // Gdyby ta reguła też go obejmowała, dwie bramki wymagałyby dwóch różnych
    // rzeczy na tym samym pliku.
    {
      filename: ROUTE_FILE,
      code: `
        export default async function ProductPage({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          const t = await getTranslations('pdp');
          return t('x');
        }
      `,
    },
    // Route entry + jawne getMessages — forma docelowa.
    {
      filename: LOCALE_LAYOUT,
      code: `
        export default async function LocaleLayout({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          const messages = await getMessages({ locale });
          return messages;
        }
      `,
    },
    // Moduł kliencki — tam obowiązuje useTranslations z providera.
    {
      filename: PDP_COMPONENT,
      code: `
        'use client';
        export function Panel({ locale }) {
          const t = getTranslations('pdp');
          return t(locale);
        }
      `,
    },
    // Plik testowy.
    {
      filename: TEST_FILE,
      code: `
        const locale = 'ua';
        const t = await getTranslations('pdp');
      `,
    },
    // Poza zakresem ścieżek (np. skrypt narzędziowy).
    {
      filename: "/repo/GP/storefront/scripts/check-i18n-key-parity.ts",
      code: `
        const locale = 'ua';
        const t = await getTranslations('pdp');
      `,
    },
    // `locale` jako właściwość obiektu nie tworzy bindingu — brak fałszywki.
    {
      filename: PDP_COMPONENT,
      code: `
        export const Panel = async ({ props }) => {
          const t = await getTranslations('pdp');
          return t(props.locale);
        };
      `,
    },
  ],

  invalid: [
    // DOKŁADNIE regresja PDP: locale w propsach, forma skrócona.
    {
      filename: PDP_COMPONENT,
      code: `
        export const ProductDetailsPage = async ({ handle, locale }: { handle: string; locale: string }) => {
          const t = await getTranslations('pdp');
          return t(handle);
        };
      `,
      errors: [{ messageId: "implicitLocale" }],
    },
    // Locale w zmiennej lokalnej (np. z getLocale()).
    {
      filename: PDP_COMPONENT,
      code: `
        export async function Surface() {
          const locale = await getLocale();
          const t = await getTranslations('seller.proof');
          return t(locale);
        }
      `,
      errors: [{ messageId: "implicitLocale" }],
    },
    // Zagnieżdżona funkcja widzi locale przez łańcuch scope'ów.
    {
      filename: PDP_COMPONENT,
      code: `
        export const Outer = async ({ locale }) => {
          const inner = async () => {
            const t = await getTranslations('cross_sell');
            return t('a');
          };
          return inner();
        };
      `,
      errors: [{ messageId: "implicitLocale" }],
    },
    // Forma bez argumentu — też kontekstozależna.
    {
      filename: PDP_COMPONENT,
      code: `
        export const Panel = async ({ locale }) => {
          const t = await getTranslations();
          return t(locale);
        };
      `,
      errors: [{ messageId: "implicitLocale" }],
    },
    // Alternatywna nazwa bindingu (localeSlug).
    {
      filename: PDP_COMPONENT,
      code: `
        export const Panel = async ({ localeSlug }) => {
          const t = await getTranslations('pdp');
          return t(localeSlug);
        };
      `,
      errors: [{ messageId: "implicitLocale" }],
    },
    // Warstwa lib też jest granicą renderu.
    {
      filename: LIB_FILE,
      code: `
        export async function buildMeta(locale: string) {
          const t = await getTranslations('pdp');
          return t('meta.title');
        }
      `,
      errors: [{ messageId: "implicitLocale" }],
    },
    // DOKŁADNIE defekt zmierzony żywym prod-buildem: setRequestLocale obok,
    // a getMessages() i tak bez locale ⇒ provider dostaje słownik default.
    {
      filename: LOCALE_LAYOUT,
      code: `
        export default async function LocaleLayout({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          const messages = await getMessages();
          return messages;
        }
      `,
      errors: [{ messageId: "implicitLocaleMessages" }],
    },
    // getMessages poza route entry też jest granicą renderu.
    {
      filename: PDP_COMPONENT,
      code: `
        export const Shell = async ({ locale }) => {
          const messages = await getMessages();
          return messages;
        };
      `,
      errors: [{ messageId: "implicitLocaleMessages" }],
    },
    // Wiele wywołań w jednej funkcji = wiele błędów (bramka nie raportuje raz).
    {
      filename: PDP_COMPONENT,
      code: `
        export const Tabs = async ({ locale }) => {
          const a = await getTranslations('common');
          const b = await getTranslations('seller.detail');
          return [a, b, locale];
        };
      `,
      errors: [
        { messageId: "implicitLocale" },
        { messageId: "implicitLocale" },
      ],
    },
  ],
});

console.log(
  "gp/explicit-locale-get-translations: wszystkie przypadki RuleTester przeszły."
);
