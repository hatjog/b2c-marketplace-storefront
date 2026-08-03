/**
 * Rule: gp/no-storefront-color-literals
 *
 * Forbids raw color literals (`#hex`, `rgb()`, `rgba()`, `hsl()`,
 * `hsla()`) inside storefront source files. All color values must
 * consume the DS token registry via `var(--token-name)` (or the
 * defensive `var(--token-name, #fallback)` fallback form).
 *
 * Scope (checked):
 *   - JSX `className` string literals and JSX expression containers
 *     wrapping template-literals / cn() / clsx() calls.
 *   - JSX `style={{ … }}` object expressions and `sx={{ … }}` props.
 *   - Raw string literals assigned to common CSS property identifiers
 *     (`color`, `backgroundColor`, `background`, `borderColor`,
 *     `fill`, `stroke`).
 *
 * Allowed forms (NOT flagged):
 *   - `var(--token-name)` — the canonical token reference.
 *   - `var(--token-name, #fallback)` — the defensive fallback form
 *     is acceptable (mirrors validator semantics).
 *   - `rgba(var(--rgb-tuple), <alpha>)` — tuple-token composition.
 *
 * Cross-ref:
 *   - Python sibling: `_grow/tools/validate_storefront_ds_literals.py`
 *   - DS SSOT: `GP/storefront/src/styles/tokens/*.css`
 *   - ADR-119 (token replication semantics), D-V180-ARCH-3.
 *
 * Authored: v1.9.1 Wave G5 (CC-3 H1 closure).
 */
"use strict";

// Bare hex / rgb / hsl literals. Excludes any form that starts with
// `var(` so `rgba(var(--tuple), 0.x)` is allowed.
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;
const RGB_LITERAL = /\brgba?\(\s*\d/;
const HSL_LITERAL = /\bhsla?\(\s*\d/;

const SUSPECT_STYLE_KEYS = new Set([
  "color",
  "backgroundColor",
  "background",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "fill",
  "stroke",
  "boxShadow",
  "textShadow",
  "caretColor",
  "accentColor",
]);

const SUSPECT_STYLE_PROPS = new Set(["style", "sx"]);

// Tailwind arbitrary-bracket prefix list — used to validate that a hex
// inside `text-[#hex]` / `bg-[rgba(…)]` etc. is a color literal in
// className (vs. a `min-h-[44px]` arbitrary length, where `[44px]` is
// not a color).
const TAILWIND_COLOR_PREFIXES = [
  "text",
  "bg",
  "border",
  "ring",
  "from",
  "to",
  "via",
  "shadow",
  "fill",
  "stroke",
  "decoration",
  "outline",
  "caret",
  "placeholder",
  "accent",
  "divide",
];

// Tailwind bracket capture inside a className string. We pre-build a
// regex that catches `<prefix>-[<inside>]` and then test the `inside`
// portion against the color literal regexes.
const TAILWIND_BRACKET_RE = new RegExp(
  `\\b(?:${TAILWIND_COLOR_PREFIXES.join("|")})-\\[(?:color:)?([^\\]\\s]+)\\]`,
  "g"
);

function isAllowedVarForm(value) {
  // `var(--token)` is OK.
  // `var(--token, #fallback)` is OK (defensive form).
  // `rgba(var(--tuple), 0.4)` is OK (rgba wrapping a var tuple).
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith("var(--")) return true;
  if (/^rgba?\(\s*var\(--/.test(trimmed)) return true;
  if (/^hsla?\(\s*var\(--/.test(trimmed)) return true;
  return false;
}

// Strip any `var(--token, <fallback>)` occurrences from the value, so
// the remaining text can be scanned for true literals. The fallback
// inside `var()` is intentionally defensive and validator-allowed.
function stripVarFallbacks(value) {
  if (typeof value !== "string") return value;
  // Repeat until no more var(--…, …) substrings remain. We strip the
  // ENTIRE `var(--token, <…>)` expression including the fallback —
  // anything outside is what we want to inspect.
  let out = value;
  let prev;
  do {
    prev = out;
    out = out.replace(/var\(--[A-Za-z0-9-_]+\s*,[^()]*\)/g, "var(--TOKEN)");
    // Handle one level of nested parens inside the fallback (e.g.
    // `var(--brand-50, rgb(238 238 238))` — the inner `rgb(...)` adds
    // a paren pair). Replace once nested parens are gone.
    out = out.replace(/var\(--[A-Za-z0-9-_]+\s*,\s*rgba?\([^)]*\)\)/g, "var(--TOKEN)");
    out = out.replace(/var\(--[A-Za-z0-9-_]+\s*,\s*hsla?\([^)]*\)\)/g, "var(--TOKEN)");
  } while (out !== prev);
  return out;
}

function valueIsColorLiteral(value) {
  if (typeof value !== "string") return false;
  if (isAllowedVarForm(value)) return false;
  // Strip var(--token, #fallback) defensive forms before scanning.
  const stripped = stripVarFallbacks(value);
  return (
    HEX_LITERAL.test(stripped) ||
    RGB_LITERAL.test(stripped) ||
    HSL_LITERAL.test(stripped)
  );
}

function classNameHasColorLiteral(text) {
  if (typeof text !== "string") return null;
  TAILWIND_BRACKET_RE.lastIndex = 0;
  let match;
  while ((match = TAILWIND_BRACKET_RE.exec(text)) !== null) {
    const inside = match[1];
    // A bracket like `min-h-[44px]` won't have `text`/`bg`/`border` as
    // the prefix; the regex restricts prefixes already. But we still
    // need to confirm the *inside* is a color, not e.g. `text-[14px]`.
    if (isAllowedVarForm(inside)) continue;
    const stripped = stripVarFallbacks(inside);
    if (
      HEX_LITERAL.test(stripped) ||
      RGB_LITERAL.test(stripped) ||
      HSL_LITERAL.test(stripped)
    ) {
      return inside;
    }
  }
  return null;
}

// Files where raw literals are legitimate (third-party SDK contracts,
// icon SVG inline encoding, etc.). Mirrors ALLOWLIST_FILES in
// _grow/tools/validate_storefront_ds_literals.py. Match is by suffix
// of the absolute file path.
const FILE_ALLOWLIST_SUFFIXES = [
  "src/components/voucher/VoucherCodeCopyButton.tsx",
  "src/components/atoms/MarketplaceVerificationMark/MarketplaceVerificationMark.tsx",
  "src/components/atoms/VerifiedMark/VerifiedMark.tsx",
  "src/components/organisms/PaymentContainer/PaymentContainer.tsx",
  "src/components/cells/SellerMap/SellerMap.tsx",
];

const PATH_FRAGMENT_ALLOWLIST = [
  "/icons/",
  "/__tests__/",
  "/tests/",
  "/leafletAssets",
];

function isAllowlistedFile(filename) {
  if (!filename) return false;
  for (const suffix of FILE_ALLOWLIST_SUFFIXES) {
    if (filename.endsWith(suffix) || filename.endsWith(suffix.replace(/\//g, "\\"))) {
      return true;
    }
  }
  for (const frag of PATH_FRAGMENT_ALLOWLIST) {
    if (filename.includes(frag)) return true;
  }
  return false;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw color literals (#hex, rgb(), rgba(), hsl(), hsla()) in storefront sources; require DS-token var(--*) consumption.",
      recommended: true,
    },
    schema: [],
    messages: {
      classNameLiteral:
        "Raw color literal `{{value}}` in className; use a DS token via var(--*) (see src/styles/tokens/*.css).",
      stylePropLiteral:
        "Raw color literal `{{value}}` on `{{key}}`; use var(--*) from src/styles/tokens/*.css (defensive `var(--token, #fallback)` is allowed).",
      stringLiteralColor:
        "String literal `{{value}}` is a raw color; consume DS token via var(--*) instead.",
    },
  },

  create(context) {
    const filename =
      (typeof context.getFilename === "function" && context.getFilename()) ||
      context.filename ||
      context.physicalFilename ||
      "";
    if (isAllowlistedFile(filename)) {
      return {};
    }
    function reportClassName(node, value) {
      const hit = classNameHasColorLiteral(value);
      if (hit) {
        context.report({
          node,
          messageId: "classNameLiteral",
          data: { value: hit },
        });
      }
    }

    function walkExpressionForString(node, cb) {
      if (!node) return;
      if (node.type === "Literal" && typeof node.value === "string") {
        cb(node.value, node);
      } else if (node.type === "TemplateLiteral") {
        for (const q of node.quasis) {
          cb(q.value.cooked || q.value.raw || "", node);
        }
      } else if (node.type === "BinaryExpression" && node.operator === "+") {
        walkExpressionForString(node.left, cb);
        walkExpressionForString(node.right, cb);
      } else if (
        node.type === "ConditionalExpression"
      ) {
        walkExpressionForString(node.consequent, cb);
        walkExpressionForString(node.alternate, cb);
      } else if (node.type === "CallExpression") {
        // cn(...), clsx(...), classnames(...) — walk all string args.
        for (const arg of node.arguments) {
          walkExpressionForString(arg, cb);
        }
      } else if (node.type === "ArrayExpression") {
        for (const el of node.elements || []) {
          if (el) walkExpressionForString(el, cb);
        }
      } else if (node.type === "ObjectExpression") {
        // cn({ 'text-[#fff]': cond }) — keys can be className strings.
        for (const prop of node.properties) {
          if (
            prop.type === "Property" &&
            prop.key &&
            prop.key.type === "Literal" &&
            typeof prop.key.value === "string"
          ) {
            cb(prop.key.value, prop.key);
          }
        }
      }
    }

    function checkStyleObject(objNode) {
      if (!objNode || objNode.type !== "ObjectExpression") return;
      for (const prop of objNode.properties) {
        if (prop.type !== "Property" || !prop.key) continue;
        const keyName =
          prop.key.type === "Identifier"
            ? prop.key.name
            : prop.key.type === "Literal"
            ? String(prop.key.value)
            : null;
        if (!keyName || !SUSPECT_STYLE_KEYS.has(keyName)) continue;
        const v = prop.value;
        if (v.type === "Literal" && valueIsColorLiteral(v.value)) {
          context.report({
            node: v,
            messageId: "stylePropLiteral",
            data: { key: keyName, value: String(v.value) },
          });
        } else if (v.type === "TemplateLiteral") {
          for (const q of v.quasis) {
            const text = q.value.cooked || q.value.raw || "";
            if (valueIsColorLiteral(text)) {
              context.report({
                node: v,
                messageId: "stylePropLiteral",
                data: { key: keyName, value: text },
              });
              break;
            }
          }
        }
      }
    }

    return {
      JSXAttribute(node) {
        if (!node.name) return;
        const attrName = node.name.name;
        if (attrName === "className") {
          if (!node.value) return;
          if (node.value.type === "Literal") {
            reportClassName(node, node.value.value);
          } else if (
            node.value.type === "JSXExpressionContainer" &&
            node.value.expression
          ) {
            walkExpressionForString(node.value.expression, (text, n) => {
              const hit = classNameHasColorLiteral(text);
              if (hit) {
                context.report({
                  node: n,
                  messageId: "classNameLiteral",
                  data: { value: hit },
                });
              }
            });
          }
        } else if (SUSPECT_STYLE_PROPS.has(attrName)) {
          if (
            node.value &&
            node.value.type === "JSXExpressionContainer" &&
            node.value.expression
          ) {
            checkStyleObject(node.value.expression);
          }
        }
      },
    };
  },
};
