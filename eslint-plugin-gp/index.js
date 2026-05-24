/**
 * eslint-plugin-gp — GP storefront local plugin.
 *
 * v1.9.1 Wave G5: introduces `no-storefront-color-literals` to enforce
 * the DS-token-only color discipline closing CC-3 H1.
 *
 * Companion validator: `_grow/tools/validate_storefront_ds_literals.py`.
 * Cross-ref: ADR-119 token replication, D-V180-ARCH-3 SSOT boundary,
 * ux.md §5.5 token discipline.
 */
"use strict";

const noColorLiterals = require("./rules/no-color-literals");

module.exports = {
  rules: {
    "no-storefront-color-literals": noColorLiterals,
  },
  configs: {
    recommended: {
      plugins: ["gp"],
      rules: {
        "gp/no-storefront-color-literals": "error",
      },
    },
  },
};
