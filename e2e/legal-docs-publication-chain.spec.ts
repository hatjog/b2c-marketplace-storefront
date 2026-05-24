/**
 * E2E-C / Suite C6 — Legal docs publication chain (v1.9.0 Wave F3)
 *
 * Wave F3:
 *   - Real `fetchLegalDocument` chain wired up in storefront.
 *   - 16 master.md published files (regulamin, polityka-prywatnosci,
 *     zasady, pomoc × pl/en/uk/de).
 *   - `LegalPageLayout` component renders trust signals
 *     (lastUpdated, version, locale switcher).
 *
 * Source refs:
 *   - GP/storefront/src/lib/legal/fetchLegalDocument.ts
 *   - GP/storefront/src/components/templates/LegalPageLayout.tsx
 *   - gp-ops/markets/bonbeauty/legal/portal/<slug>/master.md (+ .en, .uk, .de)
 *
 * NOTE: This spec lives under GP/storefront/e2e/ — the storefront Playwright
 * project executes it against http://localhost:3002 (default).
 */

import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:3002"

// Resolve from storefront cwd up to the super-repo root for fixture + master
// markdown file lookups. When run via `pnpm --dir GP/storefront`, cwd is
// GP/storefront/, so the repo root is two levels up.
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..")

const FIXTURE_PATH = path.join(
  REPO_ROOT,
  "GP",
  "e2e",
  "fixtures",
  "storefront",
  "legal-docs-publication-chain.json"
)

type LegalDoc = {
  slug: string
  master_path: string
  expected_route_pattern: string
}

type Fixture = {
  release_id: string
  matrix_cell_id: string
  primary_market: string
  locales: string[]
  documents: LegalDoc[]
  trust_signals: string[]
  layout_component: string
  placeholder_must_not_appear: string[]
  expected_published_count_master_md: number
  scenarios: string[]
}

function loadFixture(): Fixture {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as Fixture
}

async function probe(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3_000) })
    return r.status >= 200 && r.status < 500
  } catch {
    return false
  }
}

function masterFilePath(doc: LegalDoc, locale: string): string {
  const dir = path.dirname(path.join(REPO_ROOT, doc.master_path))
  if (locale === "pl") {
    return path.join(dir, "master.md")
  }
  return path.join(dir, `master.${locale}.md`)
}

let fixture: Fixture
let storefrontReachable = false
let storefrontSkipReason = ""

test.describe("Suite C6 @i18n @v190-e2e-c @needs-stack — legal docs publication chain (F3)", () => {
  test.beforeAll(async () => {
    fixture = loadFixture()
    storefrontReachable = await probe(STOREFRONT_URL)
    if (!storefrontReachable) {
      storefrontSkipReason = `Suite C6 live runtime gate not satisfied: STOREFRONT_URL (${STOREFRONT_URL}) unreachable. Filesystem + fixture contract still ran. Live PASS requires bonbeauty storefront on :3002.`
    }
  })

  test.describe("fixture contract", () => {
    test("fixture pins release, market, locales, documents, layout component", () => {
      expect(fixture.release_id).toBe("v1.9.0")
      expect(fixture.matrix_cell_id).toBe("E2E-V190-C6-LEGAL-DOCS-PUBLICATION-CHAIN")
      expect(fixture.primary_market).toBe("bonbeauty")
      expect(fixture.locales).toEqual(["pl", "en", "uk", "de"])
      expect(fixture.documents).toHaveLength(4)
      expect(fixture.layout_component).toBe("LegalPageLayout")
      expect(fixture.documents.map((d) => d.slug).sort()).toEqual(
        ["pomoc", "polityka-prywatnosci", "regulamin", "zasady"].sort()
      )
    })

    test("fixture expects 4 documents × 4 locales = 16 master.md files", () => {
      expect(fixture.expected_published_count_master_md).toBe(16)
      expect(fixture.documents.length * fixture.locales.length).toBe(16)
    })
  })

  test.describe("filesystem contract (gp-ops legal corpus)", () => {
    test("all 16 master.md files exist under gp-ops/markets/bonbeauty/legal/portal/", () => {
      const missing: string[] = []
      for (const doc of fixture.documents) {
        for (const locale of fixture.locales) {
          const fp = masterFilePath(doc, locale)
          if (!fs.existsSync(fp)) {
            missing.push(fp.replace(REPO_ROOT + path.sep, ""))
          }
        }
      }
      expect(missing, `missing master files: ${missing.join(", ")}`).toEqual([])
    })

    test("no master.md contains placeholder text (coming soon / TBD / TODO)", () => {
      const placeholders = fixture.placeholder_must_not_appear.map((p) =>
        p.toLowerCase()
      )
      const violations: string[] = []
      for (const doc of fixture.documents) {
        for (const locale of fixture.locales) {
          const fp = masterFilePath(doc, locale)
          if (!fs.existsSync(fp)) continue
          const content = fs.readFileSync(fp, "utf8").toLowerCase()
          for (const ph of placeholders) {
            if (content.includes(ph)) {
              violations.push(
                `${doc.slug}/${locale}: contains "${ph}"`
              )
            }
          }
        }
      }
      expect(violations, `placeholder text found: ${violations.join("; ")}`).toEqual([])
    })
  })

  test.describe("live storefront render (skips when storefront down)", () => {
    for (const slug of ["regulamin", "polityka-prywatnosci", "zasady", "pomoc"]) {
      for (const locale of ["pl", "en", "uk", "de"]) {
        test(`LegalPageLayout renders + trust signals visible: /${locale}/${slug}`, async ({
          page,
        }) => {
          test.skip(!storefrontReachable, storefrontSkipReason || "storefront not available")

          const url = `${STOREFRONT_URL}/${locale}/${slug}`
          const response = await page.goto(url, { waitUntil: "domcontentloaded" })
          expect(response?.status(), `${url} response status`).toBeLessThan(400)

          // LegalPageLayout signal: data-testid / class or distinctive header.
          // Use a forgiving selector list so the test surface doesn't crack
          // on a benign markup tweak.
          const layout = page
            .locator('[data-testid="legal-page-layout"], [data-component="LegalPageLayout"], main article')
            .first()
          await expect(layout, `LegalPageLayout present on ${url}`).toBeVisible({ timeout: 10_000 })

          const bodyText = await page.locator("body").innerText()
          for (const ph of ["coming soon", "TBD", "TODO"]) {
            expect(
              bodyText.toLowerCase().includes(ph.toLowerCase()),
              `placeholder "${ph}" must not appear on ${url}`
            ).toBe(false)
          }

          const lastUpdated = page.locator(
            '[data-testid="last-updated"], time[datetime], :text("aktualizac"), :text("updated")'
          )
          await expect(lastUpdated.first(), `lastUpdated on ${url}`).toBeVisible({
            timeout: 5_000,
          })

          const localeSwitcher = page.locator(
            '[data-testid="locale-switcher"], [aria-label*="language" i], [aria-label*="język" i]'
          )
          await expect(
            localeSwitcher.first(),
            `locale switcher on ${url}`
          ).toBeVisible({ timeout: 5_000 })
        })
      }
    }
  })
})
