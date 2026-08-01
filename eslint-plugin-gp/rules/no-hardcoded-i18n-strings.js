/**
 * Rule: gp/no-hardcoded-i18n-strings
 *
 * Static i18n guard for user-visible literals in TSX. The rule intentionally
 * scans AST nodes (JSXText and selected JSXAttribute values), not rendered SSR
 * output, so embedded next-intl dictionaries do not affect the signal.
 */
"use strict";

const path = require("path");

const USER_VISIBLE_ATTRS = new Set([
  "alt",
  "title",
  "placeholder",
  "aria-label",
  "label",
]);

const ALPHA_RE = /[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const WORD_CHAR_RE = /[A-Za-z0-9_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const IGNORE_DIRECTIVE_RE = /\bi18n-ignore\b(.*)$/;

function hasWordBoundary(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (!WORD_CHAR_RE.test(value[index])) continue;
    const prev = index === 0 ? "" : value[index - 1];
    const next = index === value.length - 1 ? "" : value[index + 1];
    if (!WORD_CHAR_RE.test(prev) || !WORD_CHAR_RE.test(next)) {
      return true;
    }
  }
  return false;
}

function isUserVisibleLiteral(value) {
  if (typeof value !== "string") return false;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return ALPHA_RE.test(normalized) && hasWordBoundary(normalized);
}

function normalizeValue(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function filenameLooksTsx(filename) {
  return typeof filename === "string" && filename.endsWith(".tsx");
}

function getJSXElementName(nameNode) {
  if (!nameNode) return null;
  if (nameNode.type === "JSXIdentifier") return nameNode.name;
  if (nameNode.type === "JSXMemberExpression") {
    return getJSXElementName(nameNode.property);
  }
  if (nameNode.type === "JSXNamespacedName") return nameNode.name.name;
  return null;
}

function isInsideNonVisibleElement(node) {
  let current = node && node.parent;
  while (current) {
    if (current.type === "JSXElement") {
      const elementName = getJSXElementName(current.openingElement.name);
      if (elementName === "style" || elementName === "script") {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function pathMatches(filename, filePattern) {
  if (!filePattern) return true;
  const normalizedFilename = filename.split(path.sep).join("/");
  const normalizedPattern = String(filePattern).split(path.sep).join("/");
  return (
    normalizedFilename === normalizedPattern ||
    normalizedFilename.endsWith(normalizedPattern)
  );
}

function centralAllowlistMatches(entries, filename, value, line) {
  const normalizedValue = normalizeValue(value);
  return entries.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    if (!entry.reason || !String(entry.reason).trim()) return false;
    if (!pathMatches(filename, entry.file)) return false;
    if (entry.line != null && Number(entry.line) !== Number(line)) return false;
    return normalizeValue(entry.value) === normalizedValue;
  });
}

function getLineIgnoreDirectives(sourceCode) {
  const ignoredLines = new Set();
  for (const comment of sourceCode.getAllComments()) {
    const match = IGNORE_DIRECTIVE_RE.exec(comment.value);
    if (!match) continue;
    const reason = match[1].trim();
    if (!reason) continue;
    ignoredLines.add(comment.loc.start.line);
  }
  return ignoredLines;
}

function getLiteralValue(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === "TemplateLiteral") {
    return node.quasis
      .map((quasi) => quasi.value.cooked || quasi.value.raw || "")
      .join("${...}");
  }
  return null;
}

function walkStringExpressions(node, cb) {
  if (!node) return;
  const value = getLiteralValue(node);
  if (value != null) {
    cb(value, node);
    return;
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    walkStringExpressions(node.left, cb);
    walkStringExpressions(node.right, cb);
  } else if (node.type === "ConditionalExpression") {
    walkStringExpressions(node.consequent, cb);
    walkStringExpressions(node.alternate, cb);
  } else if (node.type === "LogicalExpression") {
    // Fallback copy (`value || 'Choose a country'`, `value ?? 'Country'`,
    // `flag && 'Sold out'`) is the single most common way a literal reaches
    // the DOM, and it was structurally invisible to this rule until v1.14.0
    // QD-05. Only operand positions that can actually be the produced value
    // are walked: for `&&` the left operand is a condition, never rendered
    // as the result when it is a non-empty string being tested, but it IS
    // rendered by `||`/`??` when truthy — so `&&` walks right only.
    if (node.operator === "&&") {
      walkStringExpressions(node.right, cb);
    } else {
      walkStringExpressions(node.left, cb);
      walkStringExpressions(node.right, cb);
    }
  } else if (node.type === "TSAsExpression" || node.type === "TSNonNullExpression") {
    walkStringExpressions(node.expression, cb);
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded user-visible strings in TSX JSX text and i18n-sensitive attributes.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          allowlist: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["value", "reason"],
              properties: {
                file: { type: "string" },
                line: { type: "number" },
                value: { type: "string" },
                reason: { type: "string" },
              },
            },
          },
        },
      },
    ],
    messages: {
      hardcodedText:
        "Hardcoded user-visible JSX text `{{value}}`; use an i18n message or add `// i18n-ignore <reason>` for a documented exception.",
      hardcodedAttr:
        "Hardcoded user-visible `{{attr}}` attribute `{{value}}`; use an i18n message or add `// i18n-ignore <reason>` for a documented exception.",
    },
  },

  create(context) {
    const filename =
      (typeof context.getFilename === "function" && context.getFilename()) ||
      context.filename ||
      context.physicalFilename ||
      "";
    if (!filenameLooksTsx(filename)) {
      return {};
    }

    const sourceCode = context.sourceCode || context.getSourceCode();
    const ignoredLines = getLineIgnoreDirectives(sourceCode);
    const options = context.options && context.options[0] ? context.options[0] : {};
    const allowlist = Array.isArray(options.allowlist) ? options.allowlist : [];

    function isAllowed(node, value) {
      const line = node.loc && node.loc.start ? node.loc.start.line : null;
      if (line != null && ignoredLines.has(line)) return true;
      return centralAllowlistMatches(allowlist, filename, value, line);
    }

    function reportText(node, value) {
      if (!isUserVisibleLiteral(value) || isAllowed(node, value)) return;
      context.report({
        node,
        messageId: "hardcodedText",
        data: { value: normalizeValue(value) },
      });
    }

    function reportAttr(node, attr, value) {
      if (!isUserVisibleLiteral(value) || isAllowed(node, value)) return;
      context.report({
        node,
        messageId: "hardcodedAttr",
        data: { attr, value: normalizeValue(value) },
      });
    }

    return {
      JSXText(node) {
        if (isInsideNonVisibleElement(node)) return;
        reportText(node, node.value);
      },
      JSXExpressionContainer(node) {
        if (node.parent && node.parent.type === "JSXAttribute") return;
        if (isInsideNonVisibleElement(node)) return;
        if (!node.expression || node.expression.type === "JSXEmptyExpression") {
          return;
        }
        walkStringExpressions(node.expression, (value, valueNode) => {
          reportText(valueNode, value);
        });
      },
      JSXAttribute(node) {
        if (!node.name || !USER_VISIBLE_ATTRS.has(node.name.name)) return;
        if (!node.value) return;
        if (node.value.type === "Literal") {
          reportAttr(node.value, node.name.name, node.value.value);
          return;
        }
        if (
          node.value.type === "JSXExpressionContainer" &&
          node.value.expression
        ) {
          walkStringExpressions(node.value.expression, (value, valueNode) => {
            reportAttr(valueNode, node.name.name, value);
          });
        }
      },
    };
  },
};
