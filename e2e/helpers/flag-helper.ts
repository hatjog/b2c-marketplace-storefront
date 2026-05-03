/**
 * Flag helper — Story v160-8-8
 *
 * Wraps the test-only backend route POST /admin/test/flag-toggle
 * to read and write the multi-vendor flag state during E2E tests.
 *
 * The backend endpoint is gated by:
 *   - NODE_ENV !== 'production'
 *   - X-Test-Mode: true header
 *
 * @see GP/backend/packages/api/src/api/admin/test/flag-toggle/route.ts
 * @see specs/operator/pre-promote-smoke-checklist.md
 */

const BACKEND_BASE = process.env.BACKEND_BASE_URL ?? "http://localhost:9002"
const FLAG_TOGGLE_URL = `${BACKEND_BASE}/admin/test/flag-toggle`
const FLAG_STATUS_URL = `${BACKEND_BASE}/admin/operator/flag-flip`

export type MultiVendorFlagState = "off" | "shadow" | "on"

/**
 * Read the current multi-vendor flag state from the backend.
 */
export async function getFlagState(): Promise<MultiVendorFlagState> {
  const res = await fetch(FLAG_STATUS_URL, {
    headers: {
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) {
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
    headers: {
      "Content-Type": "application/json",
      "X-Test-Mode": "true",
    },
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
 */
export async function ensureFlagOff(): Promise<MultiVendorFlagState> {
  const current = await getFlagState()
  if (current === "off") return current
  await setFlagState("off")
  return current
}
