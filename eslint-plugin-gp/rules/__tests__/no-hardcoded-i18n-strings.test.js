/**
 * Tests for gp/no-hardcoded-i18n-strings.
 *
 * Run via: `node eslint-plugin-gp/rules/__tests__/no-hardcoded-i18n-strings.test.js`
 */
"use strict";

const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../no-hardcoded-i18n-strings");

const parserOptions = {
  ecmaVersion: 2022,
  sourceType: "module",
  ecmaFeatures: { jsx: true },
};

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions,
  },
});

const tsx = "src/components/StaticGuardCorpus.tsx";

ruleTester.run("no-hardcoded-i18n-strings", rule, {
  valid: [
    {
      name: "i18n keyed JSX expression",
      filename: tsx,
      code: "const C = ({ t }) => <button>{t('cart.checkout')}</button>;",
    },
    {
      name: "i18n keyed attr expression",
      filename: tsx,
      code: "const C = ({ t }) => <img alt={t('product.image_alt')} />;",
    },
    {
      name: "empty text",
      filename: tsx,
      code: "const C = () => <div>{null}</div>;",
    },
    {
      name: "numeric text",
      filename: tsx,
      code: "const C = () => <span>12345</span>;",
    },
    {
      name: "punctuation text",
      filename: tsx,
      code: "const C = () => <span>...</span>;",
    },
    {
      name: "icon aria hidden",
      filename: tsx,
      code: "const C = () => <svg aria-hidden=\"true\" />;",
    },
    {
      name: "non-sensitive attr className",
      filename: tsx,
      code: "const C = () => <div className=\"Buy now\" />;",
    },
    {
      name: "data attribute",
      filename: tsx,
      code: "const C = () => <div data-label=\"Buy now\" />;",
    },
    {
      name: "translation key literal in expression",
      filename: tsx,
      code: "const C = ({ t }) => <>{t('profile.settings.title')}</>;",
    },
    {
      name: "formatted message id",
      filename: tsx,
      code: "const C = () => <FormattedMessage id=\"product.add_to_cart\" />;",
    },
    {
      name: "template literal passed to t",
      filename: tsx,
      code: "const C = ({ t, id }) => <>{t(`product.${id}.title`)}</>;",
    },
    {
      name: "same-line directive with reason",
      filename: tsx,
      code: "const C = () => <button>{/* i18n-ignore brand token */}BonBeauty</button>;",
    },
    {
      name: "same-line directive for attr with reason",
      filename: tsx,
      code: "const C = () => <img /* i18n-ignore CMS-provided media title */ alt=\"BonBeauty\" />;",
    },
    {
      name: "central allowlist exact value",
      filename: tsx,
      options: [{ allowlist: [{ value: "BonBeauty", reason: "brand name" }] }],
      code: "const C = () => <span>BonBeauty</span>;",
    },
    {
      name: "central allowlist file and line",
      filename: "src/components/Allowed.tsx",
      options: [
        {
          allowlist: [
            {
              file: "src/components/Allowed.tsx",
              line: 1,
              value: "Grow Platform",
              reason: "legal product name",
            },
          ],
        },
      ],
      code: "const C = () => <span>Grow Platform</span>;",
    },
    {
      name: "central allowlist ignores malformed no-reason entry",
      filename: tsx,
      options: [{ allowlist: [{ value: "x", reason: "not this value" }] }],
      code: "const C = () => <span>{'123'}</span>;",
    },
    {
      name: "typescript file scope is ignored",
      filename: "src/lib/errors.ts",
      code: "export const message = 'Payment failed';",
    },
    {
      name: "tsx string literal outside JSX is ignored",
      filename: tsx,
      code: "const message = 'Payment failed'; const C = () => <span>{message}</span>;",
    },
    {
      name: "aria label expression from variable",
      filename: tsx,
      code: "const C = ({ label }) => <button aria-label={label} />;",
    },
    {
      name: "placeholder expression from i18n",
      filename: tsx,
      code: "const C = ({ t }) => <input placeholder={t('search.placeholder')} />;",
    },
    {
      name: "style tag CSS text is not user visible copy",
      filename: tsx,
      code: "const C = () => <style>{`.button { content: 'Buy now'; animation: none; }`}</style>;",
    },
    {
      name: "script tag text is not user visible copy",
      filename: tsx,
      code: "const C = () => <script>{`window.__label = 'Buy now';`}</script>;",
    },
  ],

  invalid: [
    {
      name: "simple JSX text",
      filename: tsx,
      code: "const C = () => <button>Buy now</button>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "polish JSX text",
      filename: tsx,
      code: "const C = () => <span>Zażółć gęślą jaźń</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "multiline JSX text",
      filename: tsx,
      code: "const C = () => <p>\n  Checkout ready\n</p>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "alt literal",
      filename: tsx,
      code: "const C = () => <img alt=\"Product photo\" />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "title literal",
      filename: tsx,
      code: "const C = () => <button title=\"Close dialog\" />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "placeholder literal",
      filename: tsx,
      code: "const C = () => <input placeholder=\"Search services\" />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "aria-label literal",
      filename: tsx,
      code: "const C = () => <button aria-label=\"Open menu\" />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "label literal",
      filename: tsx,
      code: "const C = () => <Field label=\"Email address\" />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "attr expression literal",
      filename: tsx,
      code: "const C = () => <input placeholder={'Enter city'} />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "attr template literal",
      filename: tsx,
      code: "const C = ({ name }) => <button aria-label={`Open ${name}`} />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "attr conditional expression",
      filename: tsx,
      code: "const C = ({ open }) => <button title={open ? 'Close panel' : 'Open panel'} />;",
      errors: [{ messageId: "hardcodedAttr" }, { messageId: "hardcodedAttr" }],
    },
    {
      name: "attr binary expression",
      filename: tsx,
      code: "const C = () => <button aria-label={'Open ' + 'menu'} />;",
      errors: [{ messageId: "hardcodedAttr" }, { messageId: "hardcodedAttr" }],
    },
    {
      name: "brand without directive",
      filename: tsx,
      code: "const C = () => <span>BonBeauty</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "directive without reason does not suppress",
      filename: tsx,
      code: "const C = () => <button>{/* i18n-ignore */}Buy now</button>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "central allowlist line mismatch does not suppress",
      filename: "src/components/Allowed.tsx",
      options: [
        {
          allowlist: [
            {
              file: "src/components/Allowed.tsx",
              line: 2,
              value: "Grow Platform",
              reason: "legal product name",
            },
          ],
        },
      ],
      code: "const C = () => <span>Grow Platform</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "central allowlist file mismatch does not suppress",
      filename: "src/components/Blocked.tsx",
      options: [
        {
          allowlist: [
            {
              file: "src/components/Allowed.tsx",
              value: "Grow Platform",
              reason: "legal product name",
            },
          ],
        },
      ],
      code: "const C = () => <span>Grow Platform</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "central allowlist requires reason",
      filename: tsx,
      options: [{ allowlist: [{ value: "Grow Platform", reason: "" }] }],
      code: "const C = () => <span>Grow Platform</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "sentence with number",
      filename: tsx,
      code: "const C = () => <p>Step 2 is ready</p>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "uppercase visible text",
      filename: tsx,
      code: "const C = () => <strong>NEW</strong>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "single word visible text",
      filename: tsx,
      code: "const C = () => <span>Checkout</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "JSX expression string child",
      filename: tsx,
      code: "const C = () => <button>{'Buy now'}</button>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "JSX expression template child",
      filename: tsx,
      code: "const C = ({ name }) => <span>{`Witaj ${name}`}</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
  ],
});

console.log("no-hardcoded-i18n-strings: all RuleTester cases pass.");
