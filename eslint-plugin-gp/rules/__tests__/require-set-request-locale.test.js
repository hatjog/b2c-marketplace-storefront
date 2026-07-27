/**
 * Tests for gp/require-set-request-locale (v1.14.0 Story 1.3, AC4 część (d)).
 *
 * Run via: `pnpm test:eslint-rules` (albo bezpośrednio
 * `node eslint-plugin-gp/rules/__tests__/require-set-request-locale.test.js`).
 *
 * Test dowodzi EGZEKWOWALNOŚCI, nie samej obecności pliku reguły: sekcja
 * `invalid` zawiera dokładnie regresje relandu, które reguła ma blokować
 * (brak setRequestLocale w [locale] page/layout, brak w eksportowanym
 * generateMetadata, setRequestLocale PO kontekstozależnym getTranslations).
 *
 * Dodatkowo (AC4 część (e)): test potwierdzający, że część (b) reguły 1.2
 * `gp/locale-cache-boundary` POKRYWA route'y detalu (gołe mercurClient w
 * pliku route'u detalu = błąd) — pokrycie, nie nowa mechanika.
 */
"use strict";

const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../require-set-request-locale");
const localeCacheBoundaryRule = require("../locale-cache-boundary");

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

const PDP_FILE =
  "/repo/GP/storefront/src/app/[locale]/(main)/products/[handle]/page.tsx";
const SELLER_FILE =
  "/repo/GP/storefront/src/app/[locale]/(main)/sellers/[handle]/page.tsx";
const LAYOUT_FILE = "/repo/GP/storefront/src/app/[locale]/(main)/layout.tsx";
const NON_ROUTE_FILE =
  "/repo/GP/storefront/src/components/sections/ProductDetailsPage.tsx";
const ROUTE_TEST_FILE =
  "/repo/GP/storefront/src/app/[locale]/(main)/__tests__/page.test.tsx";
const DEFAULT_SLOT_FILE =
  "/repo/GP/storefront/src/app/[locale]/(main)/@modal/default.tsx";
const NOT_FOUND_FILE =
  "/repo/GP/storefront/src/app/[locale]/(main)/products/[handle]/not-found.tsx";

ruleTester.run("require-set-request-locale", rule, {
  valid: [
    // (d1)+(d2) Kanoniczny kształt relandu: page i generateMetadata wołają
    // setRequestLocale PRZED getTranslations/fetchem.
    {
      filename: PDP_FILE,
      code: `
        import { getTranslations, setRequestLocale } from 'next-intl/server';
        export async function generateMetadata({ params }) {
          const { handle, locale } = await params;
          setRequestLocale(locale);
          const prod = await fetchProductForPage(handle, locale);
          return generateProductMetadata(prod, locale);
        }
        export default async function ProductPage({ params }) {
          const { handle, locale } = await params;
          setRequestLocale(locale);
          const t = await getTranslations('pdp');
          return null;
        }
      `,
    },
    // (d3) Jawna forma getTranslations({ locale }) jest deterministyczna —
    // nie wymusza kolejności względem setRequestLocale.
    {
      filename: SELLER_FILE,
      code: `
        import { getTranslations, setRequestLocale } from 'next-intl/server';
        export async function generateMetadata({ params }) {
          const { locale } = await params;
          const t = await getTranslations({ locale, namespace: 'seller.detail' });
          setRequestLocale(locale);
          return { title: t('title') };
        }
        export default async function SellerPage({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          return null;
        }
      `,
    },
    // (d1) Default export przez identyfikator (const Page = …; export default Page).
    {
      filename: LAYOUT_FILE,
      code: `
        import { setRequestLocale } from 'next-intl/server';
        const MainLayout = async ({ params, children }) => {
          const { locale } = await params;
          setRequestLocale(locale);
          return children;
        };
        export default MainLayout;
      `,
    },
    // Pliki spoza src/app/[locale]/** nie są w zakresie reguły.
    {
      filename: NON_ROUTE_FILE,
      code: `
        export default async function ProductDetailsPage() {
          const t = await getTranslations('pdp');
          return null;
        }
      `,
    },
    // Komponenty kliencke: setRequestLocale to API serwerowe — pomijane.
    {
      filename: PDP_FILE,
      code: `
        "use client";
        export default function ClientPage() {
          return null;
        }
      `,
    },
    // Pliki testowe pomijane.
    {
      filename: ROUTE_TEST_FILE,
      code: `export default function Fixture() { return null; }`,
    },
    // not-found.tsx: ŚWIADOMIE poza zakresem — App Router nie przekazuje mu
    // params, więc nie może wołać setRequestLocale(locale) (review 1-3-F12,
    // uzasadnienie w nagłówku reguły).
    {
      filename: NOT_FOUND_FILE,
      code: `
        import { getLocale, getTranslations } from 'next-intl/server';
        export default async function ProductNotFound() {
          const locale = await getLocale();
          return null;
        }
      `,
    },
    // Allowlist (opcja) — wpis wymaga uzasadnienia w PR.
    {
      filename: PDP_FILE,
      options: [{ allowlist: ["products/[handle]/page.tsx"] }],
      code: `
        export default async function ProductPage() {
          return null;
        }
      `,
    },
  ],

  invalid: [
    // REGRESJA RELANDU v1.13.0: generateMetadata bez setRequestLocale —
    // dokładnie luka PDP, którą 1.3 zamyka (AC2).
    {
      filename: PDP_FILE,
      code: `
        import { setRequestLocale } from 'next-intl/server';
        export async function generateMetadata({ params }) {
          const { handle, locale } = await params;
          const prod = await fetchProductForPage(handle, locale);
          return generateProductMetadata(prod, locale);
        }
        export default async function ProductPage({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          return null;
        }
      `,
      errors: [{ messageId: "missingInGenerateMetadata" }],
    },
    // (d1) Page bez setRequestLocale (dowód egzekwowalności — celowa regresja
    // „usunięcie setRequestLocale z dowolnego [locale] page" failuje).
    {
      filename: SELLER_FILE,
      code: `
        export default async function SellerPage({ params }) {
          const { locale } = await params;
          return null;
        }
      `,
      errors: [{ messageId: "missingInComponent" }],
    },
    // (d1) Layout bez setRequestLocale.
    {
      filename: LAYOUT_FILE,
      code: `
        export default async function MainLayout({ children }) {
          return children;
        }
      `,
      errors: [{ messageId: "missingInComponent" }],
    },
    // (d1) Default export przez identyfikator też jest sprawdzany.
    {
      filename: SELLER_FILE,
      code: `
        const SellerPage = async () => null;
        export default SellerPage;
      `,
      errors: [{ messageId: "missingInComponent" }],
    },
    // (d3) setRequestLocale PO kontekstozależnym getTranslations('ns') =
    // no-op dla już rozwiązanego kontekstu (AC2 — kolejność).
    {
      filename: PDP_FILE,
      code: `
        import { getTranslations, setRequestLocale } from 'next-intl/server';
        export default async function ProductPage({ params }) {
          const { locale } = await params;
          const t = await getTranslations('pdp');
          setRequestLocale(locale);
          return null;
        }
      `,
      errors: [{ messageId: "setAfterResolve" }],
    },
    // (d3) getLocale() przed setRequestLocale — ta sama klasa błędu.
    {
      filename: SELLER_FILE,
      code: `
        import { getLocale, setRequestLocale } from 'next-intl/server';
        export async function generateMetadata({ params }) {
          const current = await getLocale();
          const { locale } = await params;
          setRequestLocale(locale);
          return { title: current };
        }
        export default async function SellerPage({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          return null;
        }
      `,
      errors: [{ messageId: "setAfterResolve" }],
    },
    // (d4) Hardcoded locale: setRequestLocale('pl') to ta sama awaria co brak
    // wywołania, wpisana jawnie — literał raportowany + funkcja liczy się
    // jako niespełniająca (d1) (review 1-3-F11).
    {
      filename: PDP_FILE,
      code: `
        import { setRequestLocale } from 'next-intl/server';
        export default async function ProductPage({ params }) {
          setRequestLocale('pl');
          return null;
        }
      `,
      errors: [
        { messageId: "missingInComponent" },
        { messageId: "literalArgument" },
      ],
    },
    // (d4) Literał w generateMetadata obok poprawnego wywołania w page —
    // raportowany jest sam literał (call z identyfikatorem spełnia (d2)).
    {
      filename: SELLER_FILE,
      code: `
        import { setRequestLocale } from 'next-intl/server';
        export async function generateMetadata({ params }) {
          const { locale } = await params;
          setRequestLocale('pl');
          setRequestLocale(locale);
          return { title: 'x' };
        }
        export default async function SellerPage({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          return null;
        }
      `,
      errors: [{ messageId: "literalArgument" }],
    },
    // Zakres plików: default.tsx (parallel-route fallback) dostaje params i
    // JEST wejściem renderu — podlega (d1) (review 1-3-F12).
    {
      filename: DEFAULT_SLOT_FILE,
      code: `
        export default async function ModalDefault({ params }) {
          const { locale } = await params;
          return null;
        }
      `,
      errors: [{ messageId: "missingInComponent" }],
    },
    // (d2) `export const generateMetadata = …` (arrow) też jest sprawdzany.
    {
      filename: SELLER_FILE,
      code: `
        import { setRequestLocale } from 'next-intl/server';
        export const generateMetadata = async ({ params }) => {
          return { title: 'x' };
        };
        export default async function SellerPage({ params }) {
          const { locale } = await params;
          setRequestLocale(locale);
          return null;
        }
      `,
      errors: [{ messageId: "missingInGenerateMetadata" }],
    },
  ],
});

// AC4 część (e): pokrycie route'ów detalu przez część (b) reguły 1.2 —
// gołe mercurClient w pliku route'u detalu jest błędem BEZ zmian w regule 1.2.
ruleTester.run("locale-cache-boundary (pokrycie route'ów detalu — część (e))", localeCacheBoundaryRule, {
  valid: [
    {
      filename: PDP_FILE,
      code: `
        import { withMercurLocaleOptions } from '@/lib/sdk/locale-interceptor';
        const res = await mercurClient.store.product.query(
          await withMercurLocaleOptions({ fields: 'id' })
        );
      `,
    },
  ],
  invalid: [
    {
      filename: PDP_FILE,
      code: `const res = await mercurClient.store.product.query({ fields: 'id' });`,
      errors: [{ messageId: "bareMercurClient" }],
    },
    {
      filename: SELLER_FILE,
      code: `const res = await mercurClient.store.seller.fetch({ handle: 'x' });`,
      errors: [{ messageId: "bareMercurClient" }],
    },
  ],
});

console.log("gp/require-set-request-locale: wszystkie przypadki RuleTester przeszły.");
