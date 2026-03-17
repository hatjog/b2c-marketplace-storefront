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
  },
}
