/**
 * Playwright E2E configuration — Story v160-8-8 + Story v170-2-10 (UX evidence bundle)
 *
 * Single browser (chromium), headless default.
 * Targets BB market storefront on localhost:8000 + backend on localhost:9002.
 *
 * Projects:
 *  - chromium            — existing flag-toggle / multi-vendor suite (testDir: ./e2e, legacy specs)
 *  - chromium-ux-*       — UX evidence viewport matrix (testDir: ./e2e/ux-evidence)
 *    Six viewport projects cover the role × viewport × critical-path matrix defined in
 *    _bmad-output/releases/v1.7.0/implementation-artifacts/evidence/2-10-ux-evidence-matrix.json
 *    (UX-DR24, AC-UX13-01 through AC-UX13-07, NFR26, NFR28).
 *
 * IMPORTANT: the UX evidence specs live in e2e/ux-evidence/ so they do NOT conflict with
 * the existing stateful flag-toggle suite. The existing testDir ./e2e is preserved for
 * legacy specs; the new matrix runs use the ux-evidence sub-folder.
 *
 * @see GP/storefront/e2e/ for existing test specs
 * @see GP/storefront/e2e/ux-evidence/ for UX evidence specs (Story 2.10)
 * @see specs/operator/pre-promote-smoke-checklist.md for pre-promote procedure
 */
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  /* Legacy testDir for existing multi-vendor specs */
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
    /* ── Existing legacy project ─────────────────────────────────────── */
    {
      name: "chromium",
      testDir: "./e2e",
      use: { ...devices["Desktop Chrome"] },
      /* Exclude ux-evidence sub-folder from legacy run */
      testIgnore: ["**/ux-evidence/**"],
    },

    /* ── UX Evidence viewport matrix (Story v170-2-10) ──────────────── */
    /* All UX evidence projects use testDir: ./e2e/ux-evidence */
    /* Breakpoints: 375, 414, 768, 1024, 1440, 1920 per UX-DR24 */

    {
      name: "chromium-ux-mobile-375",
      testDir: "./e2e/ux-evidence",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "chromium-ux-mobile-414",
      testDir: "./e2e/ux-evidence",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 414, height: 896 },
      },
    },
    {
      name: "chromium-ux-tablet-768",
      testDir: "./e2e/ux-evidence",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "chromium-ux-desktop-1024",
      testDir: "./e2e/ux-evidence",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "chromium-ux-desktop-1440",
      testDir: "./e2e/ux-evidence",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-ux-desktop-1920",
      testDir: "./e2e/ux-evidence",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "chromium-vr",
      testDir: "./tests/visual-regression",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  /* No web-server auto-start — environment expected up per checklist */
})
