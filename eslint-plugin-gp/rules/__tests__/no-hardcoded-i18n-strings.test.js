/**
 * Tests for gp/no-hardcoded-i18n-strings.
 *
 * Run via: `node eslint-plugin-gp/rules/__tests__/no-hardcoded-i18n-strings.test.js`
 */
"use strict";

const { describe, it } = require("node:test");
const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../no-hardcoded-i18n-strings");

// Without this wiring RuleTester runs the cases but registers none of them with
// the test runner: the suite reported a flat "52 tests" no matter how many
// cases were added, so a case that silently stopped running was
// indistinguishable from one that passed. It also stops RuleTester from
// aborting the whole file on the first failure.
RuleTester.describe = describe;
RuleTester.it = it;

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
      options: [
        { allowlist: [{ file: tsx, value: "BonBeauty", reason: "brand name" }] },
      ],
      code: "const C = () => <span>BonBeauty</span>;",
    },
    {
      name: "central allowlist file scope",
      filename: "src/components/Allowed.tsx",
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
    },
    {
      // Regression guard for the failure mode that fired twice in QD-05: a
      // comment inserted above a waived literal shifted its reported line and
      // the gate lit up on an unrelated edit. Entries anchor to content, so
      // pushing the literal down the file must NOT resurrect the error.
      name: "allowlist survives a line shift (QD-05 brittleness regression)",
      filename: "src/components/Allowed.tsx",
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
      code: [
        "// a newly added comment",
        "// and another one",
        "const C = () => <span>Grow Platform</span>;",
      ].join("\n"),
    },
    {
      name: "default parameter outside the user-visible attr set is not flagged",
      filename: tsx,
      code: "const C = ({ deliveryCode = 'DHL' }) => <span>{deliveryCode}</span>;",
    },
    {
      name: "user-visible default parameter bound to a translation is fine",
      filename: tsx,
      code: "const C = ({ t, placeholder = t('forms.country') }) => <input placeholder={placeholder} />;",
    },
    {
      name: "rest element in a destructured param does not crash the walker",
      filename: tsx,
      code: "const C = ({ placeholder, ...rest }) => <input placeholder={placeholder} {...rest} />;",
    },
    {
      name: "allowlist matches across Unicode normalization forms",
      filename: "src/components/Allowed.tsx",
      options: [
        {
          // NFC form of "Przeglądaj"
          allowlist: [
            {
              file: "src/components/Allowed.tsx",
              value: "Przeglądaj",
              reason: "waived brand copy",
            },
          ],
        },
      ],
      // NFD form: a + combining ogonek
      code: "const C = () => <span>Przeglądaj</span>;",
    },
    {
      name: "central allowlist ignores malformed no-reason entry",
      filename: tsx,
      options: [
        { allowlist: [{ file: tsx, value: "x", reason: "not this value" }] },
      ],
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
    {
      name: "logical fallback to an i18n call is not a literal",
      filename: tsx,
      code: "const C = ({ label, t }) => <span>{label || t('common.untitled')}</span>;",
    },
    {
      name: "logical AND guard on a non-copy condition still renders keyed copy",
      filename: tsx,
      code: "const C = ({ isOpen, t }) => <span>{isOpen && t('common.open')}</span>;",
    },
  ],

  invalid: [
    // v1.14.0 QD-05 — LogicalExpression was structurally invisible to
    // walkStringExpressions, so fallback copy (the most common way a literal
    // reaches the DOM) was never reported. `CountrySelect` shipped an
    // untranslated `'Choose a country'` through the whole v1.13.0 baseline
    // precisely because nothing ever flagged it.
    {
      name: "logical OR fallback literal in JSX text",
      filename: tsx,
      code: "const C = ({ label }) => <span>{label || 'Choose a country'}</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "nullish coalescing fallback literal in JSX text",
      filename: tsx,
      code: "const C = ({ label }) => <span>{label ?? 'Choose a country'}</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "logical AND right operand literal in JSX text",
      filename: tsx,
      code: "const C = ({ soldOut }) => <span>{soldOut && 'Sold out'}</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "logical OR fallback literal in a user visible attribute",
      filename: tsx,
      code: "const C = ({ label }) => <img alt={label || 'Product thumbnail'} />;",
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "logical fallback nested under a conditional expression",
      filename: tsx,
      code: "const C = ({ a, b, t }) => <span>{a ? (b || 'Choose a country') : t('x.y')}</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
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
      name: "central allowlist value mismatch does not suppress",
      filename: "src/components/Allowed.tsx",
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
      code: "const C = () => <span>Grow Platfrom</span>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      // `placeholder = 'Country'` shipped untranslated copy that nothing
      // reported, because a default parameter never becomes a JSXAttribute node.
      name: "hardcoded default for a user-visible prop is flagged",
      filename: tsx,
      code: "const C = ({ placeholder = 'Select...' }) => <input placeholder={placeholder} />;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      name: "hardcoded default in a destructured forwardRef param is flagged",
      filename: tsx,
      code: "const C = ({ label = 'Delivery', price }) => <p>{label}{price}</p>;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      name: "hardcoded default in a plain function declaration is flagged",
      filename: tsx,
      code: "function C({ title = 'Order summary' }) { return <h2>{title}</h2>; }",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      name: "hardcoded default reached through a fallback chain is flagged",
      filename: tsx,
      code: "const C = ({ alt = props.alt || 'Product photo' }) => <img alt={alt} />;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    // Each case below was a VERIFIED 0-error evasion of the first version of
    // this branch. They are pinned so the branch cannot silently narrow again.
    {
      name: "renaming the binding does not move the literal out of scope",
      filename: tsx,
      code: "const C = ({ placeholder: ph = 'Select a country' }) => <input placeholder={ph} />;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      name: "nested destructuring is flagged",
      filename: tsx,
      code: "const C = ({ opts: { label = 'Delivery cost' } }) => <p>{label}</p>;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      name: "whole-parameter default object is flagged",
      filename: tsx,
      code: "const C = ({ placeholder = 'Select a country' } = {}) => <input placeholder={placeholder} />;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      name: "array pattern default is flagged",
      filename: tsx,
      code: "const C = ([label = 'Delivery']) => <p>{label}</p>;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      name: "satisfies expression does not bypass the default check",
      filename: tsx,
      code: "const C = ({ placeholder = ('Country' satisfies string) }) => <input placeholder={placeholder} />;",
      errors: [{ messageId: "hardcodedDefault" }],
    },
    // NOTE: an allowlist entry WITHOUT `file` is rejected by the rule schema
    // (`required: [file, value, reason]`), so it surfaces as a hard ESLint
    // configuration error rather than as an unsuppressed report. That is
    // deliberate: a file-less waiver would disable a literal storefront-wide.
    // RuleTester cannot assert schema rejection, so the guarantee lives in the
    // schema plus `pathMatches` returning false for a missing pattern.
    {
      name: "allowlist file match must land on a path-segment boundary",
      filename: "src/components/MiniCart.tsx",
      options: [
        {
          allowlist: [
            {
              file: "Cart.tsx",
              value: "Grow Platform",
              reason: "scoped to a different component",
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
      options: [
        { allowlist: [{ file: tsx, value: "Grow Platform", reason: "" }] },
      ],
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
