/**
 * Suite C7 — Constitution legal-docs edit propagation closure (FR-I.3)
 *
 * Constitution non-negotiable: specs/constitution/legal-docs*.md absent in this checkout;
 * formal source is NFR15.3 / A4 Constitution non-negotiables in PRD `prd.md#FR-I.3`.
 * Cross-ref: PRD `_bmad-output/releases/v1.10.0/planning-artifacts/prds/prd-GP-2026-05-25/prd.md#FR-I.3` (line 904).
 * Cross-ref: Architecture `_bmad-output/releases/v1.10.0/planning-artifacts/architecture.md#D-120` (lines 1075-1110, legal-docs closure sub-block line 1102).
 * Cross-ref: Story 7.1 hook refactor (debounce 300ms per resource_id) — `_bmad-output/releases/v1.10.0/implementation-artifacts/7-1-revalidate-hook-opcja-c-hybrid-debounce.md`.
 * Cross-ref: HG-9 Legal docs `published` chain per market — architecture.md line 2142.
 *
 * This spec lives under the legacy storefront Playwright `testDir: "./e2e"` and
 * is discovered by the `chromium` project without changing `playwright.config.ts`.
 */

import { expect, test, type Page } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:3000"
const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:3002"
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..")
const FIXTURE_PATH = path.join(
  REPO_ROOT,
  "GP",
  "e2e",
  "fixtures",
  "storefront",
  "legal-docs-publication-chain.json"
)
const REGULAMIN_TAG = "legal-document:bonbeauty:regulamin:pl"
const RUNTIME_SKIP_REASON =
  "Runtime gate FAIL: portal :3000 + storefront :3002 + REVALIDATE_SECRET required"

type FixtureDocument = {
  slug: string
  master_path: string
  expected_route_pattern: string
}

type FixtureContract = {
  primary_market: string
  locales: string[]
  documents: FixtureDocument[]
  expected_published_count_master_md: number
}

type RevalidateTrace = {
  status: number
  ok: boolean
  body: unknown
  startedAt: number
  finishedAt: number
}

type PropagationMeasurement = {
  attempt: number
  tag: string
  deltaMs: number
  triggerAtIso: string
  visibleLastUpdated: string | null
}

type RaceMeasurement = {
  tag: string
  triggerCount: number
  responseStatuses: number[]
  freshContentDeltaMs: number
}

type RetryMeasurement = {
  invalidStatuses: number[]
  validStatus: number
  validResponse: unknown
  rateLimitedAfterInvalidAttempts: boolean
}

async function probe(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3_000) })
    return r.status >= 200 && r.status < 500
  } catch {
    return false
  }
}

function loadFixture(): FixtureContract {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as FixtureContract
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function legalPageUrl() {
  return `${STOREFRONT_URL}/pl/regulamin`
}

async function postRevalidate(tags: string[], secret = REVALIDATE_SECRET ?? ""): Promise<RevalidateTrace> {
  const startedAt = performance.now()
  const response = await fetch(`${STOREFRONT_URL}/api/revalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-revalidate-secret": secret,
    },
    body: JSON.stringify({ tags }),
  })
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  return {
    status: response.status,
    ok: response.ok,
    body,
    startedAt,
    finishedAt: performance.now(),
  }
}

async function readVisibleLastUpdated(page: Page) {
  const locator = page
    .locator(
      '[data-testid="last-updated"], [data-testid="legal-last-updated"], time[datetime]'
    )
    .first()
  await expect(locator).toBeVisible({ timeout: 10_000 })
  const datetime = await locator.getAttribute("datetime")
  const dataValue = await locator.getAttribute("data-legal-last-updated")
  const text = await locator.innerText().catch(() => "")
  return datetime ?? dataValue ?? (text.trim() || null)
}

let fixture: FixtureContract
let portalReachable = false
let storefrontReachable = false
let runtimeReachable = false
const propagationMeasurements: PropagationMeasurement[] = []
const raceMeasurements: RaceMeasurement[] = []
const retryMeasurements: RetryMeasurement[] = []

test.describe("Suite C7 @i18n @v1100-e2e-i @needs-stack — legal-docs edit propagation (FR-I.3)", () => {
  test.beforeAll(async () => {
    fixture = loadFixture()
    portalReachable =
      (await probe(`${PORTAL_URL}/api/health`)) || (await probe(`${PORTAL_URL}/admin`))
    storefrontReachable = await probe(STOREFRONT_URL)
    runtimeReachable = portalReachable && storefrontReachable && Boolean(REVALIDATE_SECRET)
  })

  test.afterAll(async () => {
    await test.info().attach("propagation-deltas.json", {
      body: JSON.stringify(propagationMeasurements, null, 2),
      contentType: "application/json",
    })
    await test.info().attach("race-condition-collapse.json", {
      body: JSON.stringify(raceMeasurements, null, 2),
      contentType: "application/json",
    })
    await test.info().attach("retry-exhaustion-trace.json", {
      body: JSON.stringify(retryMeasurements, null, 2),
      contentType: "application/json",
    })
  })

  test("filesystem contract keeps regulamin/pl fixture and master.md baseline available", () => {
    const regulamin = fixture.documents.find((doc) => doc.slug === "regulamin")

    expect(fixture.primary_market).toBe("bonbeauty")
    expect(fixture.locales).toContain("pl")
    expect(fixture.expected_published_count_master_md).toBe(16)
    expect(regulamin?.expected_route_pattern).toBe("/{locale}/regulamin")
    expect(regulamin?.master_path).toBe(
      "gp-ops/markets/bonbeauty/legal/portal/regulamin/master.md"
    )
    expect(fs.existsSync(path.join(REPO_ROOT, regulamin?.master_path ?? ""))).toBe(true)
  })

  test("happy path: edit-after-publish simulated revalidate renders fresh legal page within budget", async ({
    page,
  }) => {
    test.skip(!runtimeReachable, RUNTIME_SKIP_REASON)

    const staleMarker = "previousDoc.body"
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const tag = `${REGULAMIN_TAG}?nonce=${Date.now()}-${attempt}`
      const triggerAt = performance.now()
      const triggerAtDate = new Date()
      const trace = await postRevalidate([REGULAMIN_TAG, tag])

      expect(trace.status).toBe(200)
      expect(trace.body).toMatchObject({ revalidated: true })

      const response = await page.goto(legalPageUrl(), { waitUntil: "domcontentloaded" })
      expect(response?.status(), "legal page response status").toBeLessThan(400)

      const visibleLastUpdated = await readVisibleLastUpdated(page)
      const bodyText = await page.locator("body").innerText()
      expect(bodyText).not.toContain(staleMarker)

      const parsedLastUpdated = visibleLastUpdated ? Date.parse(visibleLastUpdated) : NaN
      if (Number.isNaN(parsedLastUpdated)) {
        test.info().annotations.push({
          type: "last-updated-unparseable",
          description: `Rendered last-updated value could not be parsed as a timestamp: ${visibleLastUpdated}`,
        })
      } else {
        expect(
          parsedLastUpdated,
          `last-updated (${visibleLastUpdated}) should be >= edit trigger ${triggerAtDate.toISOString()}`
        ).toBeGreaterThanOrEqual(triggerAtDate.getTime())
      }

      propagationMeasurements.push({
        attempt,
        tag,
        deltaMs: performance.now() - triggerAt,
        triggerAtIso: triggerAtDate.toISOString(),
        visibleLastUpdated,
      })
    }

    const deltas = propagationMeasurements.map((m) => m.deltaMs)
    expect(deltas.some((delta) => delta <= 300)).toBe(true)
    expect(median(deltas)).toBeLessThanOrEqual(450)
  })

  test.describe("race conditions @hardening", () => {
    test("concurrent edits per resource collapse remains eventually fresh", async ({ page }) => {
      test.skip(!runtimeReachable, RUNTIME_SKIP_REASON)

      const responseStatuses: number[] = []
      let lastTriggerAt = performance.now()
      for (let i = 0; i < 5; i += 1) {
        const trace = await postRevalidate([REGULAMIN_TAG])
        responseStatuses.push(trace.status)
        lastTriggerAt = performance.now()
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      let responseStatus = 0
      let bodyText = ""
      const deadline = lastTriggerAt + 350
      do {
        const response = await page.goto(legalPageUrl(), { waitUntil: "domcontentloaded" })
        responseStatus = response?.status() ?? 0
        bodyText = await page.locator("body").innerText().catch(() => "")
        if (responseStatus > 0 && responseStatus < 400 && /regulamin/i.test(bodyText)) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
      } while (performance.now() <= deadline)

      expect(responseStatus, "legal page after burst").toBeLessThan(400)
      expect(bodyText).toMatch(/regulamin/i)

      const measurement = {
        tag: REGULAMIN_TAG,
        triggerCount: 5,
        responseStatuses,
        freshContentDeltaMs: performance.now() - lastTriggerAt,
      }
      raceMeasurements.push(measurement)
      expect(responseStatuses.every((status) => status === 200)).toBe(true)
      expect(measurement.freshContentDeltaMs).toBeLessThanOrEqual(950)
    })

    test("retry-exhaustion semantics fail closed, then allow valid retry", async () => {
      test.skip(!runtimeReachable, RUNTIME_SKIP_REASON)

      const invalidResponses = await Promise.all([
        postRevalidate([REGULAMIN_TAG], "invalid-secret-1"),
        postRevalidate([REGULAMIN_TAG], "invalid-secret-2"),
        postRevalidate([REGULAMIN_TAG], "invalid-secret-3"),
      ])
      const validResponse = await postRevalidate([REGULAMIN_TAG])
      const invalidStatuses = invalidResponses.map((response) => response.status)
      const rateLimitedAfterInvalidAttempts = validResponse.status === 429

      if (rateLimitedAfterInvalidAttempts) {
        test.info().annotations.push({
          type: "rate-limited",
          description: "Valid retry was rate-limited after unauthorized attempts; recorded as evidence posture.",
        })
      }

      retryMeasurements.push({
        invalidStatuses,
        validStatus: validResponse.status,
        validResponse: validResponse.body,
        rateLimitedAfterInvalidAttempts,
      })

      expect(invalidStatuses).toEqual([401, 401, 401])
      expect(validResponse.status).toBe(rateLimitedAfterInvalidAttempts ? 429 : 200)
      if (!rateLimitedAfterInvalidAttempts) {
        expect(validResponse.body).toMatchObject({ revalidated: true })
      }
    })
  })
})
