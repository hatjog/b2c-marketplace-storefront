/**
 * Flag helper — Story v160-8-8
 *
 * Wraps the test-only backend route POST /admin/e2e-flag-toggle
 * to read and write the multi-vendor flag state during E2E tests.
 *
 * The backend endpoint is gated by:
 *   - NODE_ENV !== 'production'
 *   - X-Test-Mode: true header
 *
 * @see GP/backend/packages/api/src/api/admin/e2e-flag-toggle/route.ts
 * @see specs/operator/pre-promote-smoke-checklist.md
 */

const BACKEND_BASE = process.env.BACKEND_BASE_URL ?? "http://localhost:9002"
const FLAG_TOGGLE_URL = `${BACKEND_BASE}/admin/e2e-flag-toggle`
// Use the same test route for reads (GET) so both ops share identical auth guards.
const FLAG_STATUS_URL = FLAG_TOGGLE_URL

// Standard headers required by the test-only endpoint.
const TEST_HEADERS = {
  "Content-Type": "application/json",
  "X-Test-Mode": "true",
} as const

export type MultiVendorFlagState = "off" | "shadow" | "on"

export class FlagEndpointPreconditionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message)
    this.name = "FlagEndpointPreconditionError"
  }
}

async function readFlagStateResponse(): Promise<Response> {
  return fetch(FLAG_STATUS_URL, {
    headers: TEST_HEADERS,
  })
}

function isPreconditionFailure(status: number, body: string): boolean {
  return (
    status === 403 &&
    (body.includes("test_endpoint_disabled") ||
      body.includes("x_test_mode_header_required"))
  )
}

/**
 * Probe the test-only flag endpoint before the suite mutates flag state.
 * Returns a human-readable skip reason when the live test preconditions are
 * not enabled on the backend.
 */
export async function probeFlagEndpoint(): Promise<string | null> {
  const res = await readFlagStateResponse()
  if (res.ok) return null

  const body = await res.text()
  if (isPreconditionFailure(res.status, body)) {
    return (
      `Flag endpoint precondition failed: ${res.status} ${res.statusText}. ` +
      "Run backend with ALLOW_TEST_ENDPOINTS=true and NODE_ENV!=production " +
      "for Story 8.8 AC6 flag-on E2E, or record a formal BMAD SKIP."
    )
  }

  throw new Error(
    `probeFlagEndpoint: backend returned ${res.status} ${res.statusText} — ${body}`,
  )
}

/**
 * Read the current multi-vendor flag state from the backend.
 */
export async function getFlagState(): Promise<MultiVendorFlagState> {
  const res = await readFlagStateResponse()
  if (!res.ok) {
    const body = await res.text()
    if (isPreconditionFailure(res.status, body)) {
      throw new FlagEndpointPreconditionError(
        `getFlagState: flag endpoint precondition failed (${res.status} ${res.statusText})`,
        res.status,
        body,
      )
    }
    throw new Error(
      `getFlagState: backend returned ${res.status} ${res.statusText}`,
    )
  }
  const body = (await res.json()) as { current_state: MultiVendorFlagState }
  return body.current_state
}

/**
 * Set the multi-vendor flag state via the test-only endpoint.
 * Throws if the backend rejects the transition.
 */
export async function setFlagState(
  toState: MultiVendorFlagState,
): Promise<{ from: MultiVendorFlagState; to: MultiVendorFlagState }> {
  const res = await fetch(FLAG_TOGGLE_URL, {
    method: "POST",
    headers: TEST_HEADERS,
    body: JSON.stringify({ to_state: toState }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(
      `setFlagState(${toState}): backend returned ${res.status} — ${err}`,
    )
  }
  return res.json() as Promise<{
    from: MultiVendorFlagState
    to: MultiVendorFlagState
  }>
}

/**
 * Assert that the flag is in the expected state; throw if not.
 */
export async function assertFlagState(
  expected: MultiVendorFlagState,
): Promise<void> {
  const current = await getFlagState()
  if (current !== expected) {
    throw new Error(
      `assertFlagState: expected '${expected}' but got '${current}'`,
    )
  }
}

/**
 * Ensure flag is ON — set it if currently different.
 * Returns the previous state so callers can restore after the test.
 */
export async function ensureFlagOn(): Promise<MultiVendorFlagState> {
  const current = await getFlagState()
  if (current === "on") return current
  // Transition via shadow if currently off (ALLOWED_TRANSITIONS)
  if (current === "off") {
    await setFlagState("shadow")
    await setFlagState("on")
  } else if (current === "shadow") {
    await setFlagState("on")
  }
  return current
}

/**
 * Ensure flag is OFF — set it if currently different.
 * Returns the previous state so callers can restore after the test.
 *
 * ISOLATION WARNING: the on→off transition triggers cache invalidation
 * (ISR tag revalidation, Redis key busting). Run only against a dedicated
 * staging instance — not against a process shared with live traffic.
 */
export async function ensureFlagOff(): Promise<MultiVendorFlagState> {
  const current = await getFlagState()
  if (current === "off") return current
  await setFlagState("off")
  return current
}
