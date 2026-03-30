module.exports = {
  extends: ["next/core-web-vitals"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  settings: {
    "import/resolver": {
      typescript: true,
    },
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    }],
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "no-console": ["error", { allow: ["error", "warn"] }],
    "no-restricted-globals": ["error",
      { name: "event", message: "Use local parameter instead of global 'event'." },
      { name: "name", message: "Use a local variable instead of global 'name'." },
      { name: "status", message: "Use a local variable instead of global 'status'." },
    ],
    "import/no-relative-parent-imports": "warn",
    "eqeqeq": ["error", "always", { "null": "ignore" }],
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        "message": "dangerouslySetInnerHTML is banned. Use <SanitizedHTML> server component (SSR) or sanitizeOnFetch() utility (CSR). See Story 0.4."
      },
      {
        "selector": "AssignmentExpression[left.property.name='innerHTML']",
        "message": "innerHTML assignment is banned. Use <SanitizedHTML> or sanitizeOnFetch(). See Story 0.4."
      },
      {
        "selector": "CallExpression[callee.object.name='document'][callee.property.name='write']",
        "message": "document.write() is banned. See Story 0.4."
      }
    ],
  },
}
