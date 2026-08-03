/**
 * Tests for gp/no-storefront-color-literals.
 *
 * Run via: `node eslint-plugin-gp/rules/__tests__/no-color-literals.test.js`
 * (uses ESLint's bundled RuleTester so no extra deps required if
 * eslint is already installed at the workspace root).
 */
"use strict";

const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../no-color-literals");

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

ruleTester.run("no-storefront-color-literals", rule, {
  valid: [
    // var(--token) — canonical form
    {
      code: '<div className="bg-[var(--bb-surface)] text-[var(--text-primary)]" />',
    },
    // var(--token, #fallback) — defensive fallback
    {
      code: '<div className="bg-[var(--bb-surface,#fff)]" />',
    },
    // rgba(var(--tuple), <alpha>) — tuple-token composition
    {
      code: '<div style={{ color: "rgba(var(--brand-800), 1)" }} />',
    },
    // Inline style with var()
    {
      code: '<div style={{ backgroundColor: "var(--bb-page-bg)" }} />',
    },
    // Non-color brackets (min-h-[44px]) — must not flag
    {
      code: '<div className="min-h-[44px] text-[14px]" />',
    },
    // cn() / clsx() with token only
    {
      code: 'import cn from "clsx"; const x = <div className={cn("bg-[var(--cta)]", on && "text-[var(--text-primary)]")} />;',
    },
    // Defensive var(--token, #fallback) form inside larger expressions
    {
      code: '<div style={{ background: "linear-gradient(to bottom, var(--bb-surface, #fff), var(--bb-cream-75, #f8f3ec))" }} />',
    },
    // Defensive form with rgb fallback inside var()
    {
      code: '<div style={{ background: "linear-gradient(to right, var(--brand-50, rgb(238 238 238)))" }} />',
    },
    // Tailwind bracket with defensive var fallback inside
    {
      code: '<div className="bg-[var(--bb-surface,#fafafa)]" />',
    },
  ],

  invalid: [
    // Tailwind bracket hex literal
    {
      code: '<div className="bg-[#fff]" />',
      errors: [{ messageId: "classNameLiteral" }],
    },
    // Tailwind bracket rgba literal
    {
      code: '<div className="border-[rgba(144,112,50,0.14)]" />',
      errors: [{ messageId: "classNameLiteral" }],
    },
    // [color:rgba(...)] arbitrary color prefix
    {
      code: '<div className="text-[color:rgba(250,248,245,0.72)]" />',
      errors: [{ messageId: "classNameLiteral" }],
    },
    // Inline style hex
    {
      code: '<div style={{ backgroundColor: "#faf8f5" }} />',
      errors: [{ messageId: "stylePropLiteral" }],
    },
    // Inline style rgba (not wrapping a var)
    {
      code: '<div style={{ color: "rgba(255,255,255,0.86)" }} />',
      errors: [{ messageId: "stylePropLiteral" }],
    },
    // Template-literal in className with literal inside
    {
      code: 'const x = <div className={`flex bg-[#fff] gap-2`} />;',
      errors: [{ messageId: "classNameLiteral" }],
    },
    // Conditional / cn() with literal inside string arg
    {
      code: 'import cn from "clsx"; const x = <div className={cn("bg-[rgba(0,0,0,0.5)]")} />;',
      errors: [{ messageId: "classNameLiteral" }],
    },
  ],
});

console.log("no-storefront-color-literals: all RuleTester cases pass.");
