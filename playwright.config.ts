/**
 * Playwright E2E configuration — Story v160-8-8
 *
 * Single browser (chromium), headless default.
 * Targets BB market storefront on localhost:8000 + backend on localhost:9002.
 *
 * @see GP/storefront/e2e/ for test specs
 * @see specs/operator/pre-promote-smoke-checklist.md for pre-promote procedure
 */
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",

  /* Retry once on failure */
  retries: 1,

  /* Global test timeout */
  timeout: 30_000,

  /* Parallelism disabled — flag-toggle tests are stateful */
  workers: 1,
  fullyParallel: false,

  /* Reporter: list for CI + HTML report for humans */
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: "http://localhost:8000",

    /* Backend base used by helpers */
    extraHTTPHeaders: {
      Accept: "application/json",
    },

    trace: "on-first-retry",
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* No web-server auto-start — environment expected up per checklist */
})
