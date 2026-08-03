export type WalletTelemetryProvider = "google" | "apple"
export type WalletTelemetryLocale = "pl-PL" | "en-US" | "uk-UA" | "de-DE"
// P25 (D2): extended with `auth_expired` and `client_error`. Keep in sync
// with GP/backend/packages/wallet/src/telemetry/types.ts (SSOT) and the
// apps/web duplicate.
export type WalletFailureCode =
  | "provider_error"
  | "network"
  | "policy_deny"
  | "auth_expired"
  | "client_error"

export type WalletTelemetryCommonProps = {
  provider: WalletTelemetryProvider
  market: string
  locale: WalletTelemetryLocale
  actor: "P4"
  entitlement_type: string
  entitlement_instance_id: string
}

// P19: WalletSavedClientProps acknowledges the derived per-call properties
// (`device_class`, `os_family`) the helper attaches before capture.
export type WalletSavedClientProps = WalletTelemetryCommonProps & {
  device_class?: "mobile" | "desktop"
  os_family?: "ios" | "android" | "other"
}

export type WalletFailedClientProps = WalletTelemetryCommonProps & {
  failure_code: WalletFailureCode
  error_message: string
}

type PostHogWindow = Window & {
  posthog?: {
    capture?: (
      event: string,
      properties: Record<string, unknown>,
      options?: { $distinct_id?: string }
    ) => void
    identify?: (distinctId: string) => void
  }
}

// P1: shared funnel-join distinct_id so frontend `pass_saved` matches the
// backend `pass_generated` (which uses `actor:P4:<entitlement_instance_id>`).
export function buildWalletDistinctId(entitlement_instance_id: string): string {
  return `actor:P4:${entitlement_instance_id}`
}

// R-M4 (phase-4): caller-aware variant for failure counters. Anon suffix is
// substituted when entitlement_instance_id is empty so each failure stays
// distinct in PostHog instead of collapsing into `actor:P4:`.
function buildWalletDistinctIdForFailure(
  entitlement_instance_id: string
): string {
  if (entitlement_instance_id.length > 0)
    return `actor:P4:${entitlement_instance_id}`
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto
  const suffix =
    typeof cryptoRef?.randomUUID === "function"
      ? cryptoRef.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `actor:P4:anon-${suffix}`
}

export function emitWalletSaved(props: WalletSavedClientProps): void {
  // F3: SSR / edge runtime guard.
  if (typeof window === "undefined") return
  // R-M4 (phase-4): skip emit on empty entitlement_instance_id — success
  // counters carry no diagnostic value without an id, and merging into
  // `actor:P4:` would collapse the PostHog person.
  if (
    typeof props.entitlement_instance_id !== "string" ||
    props.entitlement_instance_id.length === 0
  ) {
    return
  }

  const storageKey = `wallet_saved_${props.entitlement_instance_id}`
  // R-H4 (phase-4): split semantics for sessionStorage absence vs throw.
  // - ABSENT (embedded webviews stripping storage APIs) -> fail OPEN.
  // - FAILED (throw on Safari Private Mode etc.) -> fail CLOSED.
  const prior = readSessionStorage(storageKey)
  if (prior === "1" || prior === "FAILED") return
  // prior === "ABSENT" or null -> allow emit.

  captureWalletEvent(
    "wallet.pass_saved",
    {
      ...props,
      device_class: props.device_class ?? getDeviceClass(),
      os_family: props.os_family ?? getOsFamily(),
    },
    buildWalletDistinctId(props.entitlement_instance_id)
  )
  writeSessionStorage(storageKey, "1")
}

export function emitWalletFailed(props: WalletFailedClientProps): void {
  if (typeof window === "undefined") return
  // R-M3 (phase-4): empty-check BEFORE sanitization (matches backend).
  // `sanitizeTelemetryErrorMessage(null/undefined/"")` returns the synthetic
  // placeholder `"unknown_error"` which would otherwise be shipped as a
  // useless diagnostic.
  if (
    typeof props.error_message !== "string" ||
    props.error_message.trim().length === 0
  ) {
    return
  }
  const message = sanitizeTelemetryErrorMessage(props.error_message)
  if (!message || message.trim().length === 0) return
  captureWalletEvent(
    "wallet.pass_failed",
    {
      ...props,
      error_message: message,
    },
    // R-M4 (phase-4): failure path uses anon-uuid suffix when id is empty.
    buildWalletDistinctIdForFailure(
      typeof props.entitlement_instance_id === "string"
        ? props.entitlement_instance_id
        : ""
    )
  )
}

export function getDeviceClass(): "mobile" | "desktop" {
  // F11: SSR guard.
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop"
  }
  if (window.matchMedia?.("(max-width: 768px)").matches) return "mobile"
  // P17: iPadOS 13+ reports a desktop Safari UA but exposes maxTouchPoints>1.
  const nav = navigator as Navigator & { maxTouchPoints?: number }
  if (
    /Macintosh/i.test(nav.userAgent) &&
    typeof nav.maxTouchPoints === "number" &&
    nav.maxTouchPoints > 1
  ) {
    return "mobile"
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)
    ? "mobile"
    : "desktop"
}

export function getOsFamily(userAgent?: string): "ios" | "android" | "other" {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  // P17: iPadOS 13+ desktop UA fallback.
  if (
    typeof navigator !== "undefined" &&
    /Macintosh/i.test(ua) &&
    typeof (navigator as Navigator & { maxTouchPoints?: number })
      .maxTouchPoints === "number" &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1
  ) {
    return "ios"
  }
  if (/Android/i.test(ua)) return "android"
  return "other"
}

// P4/P8/P23/P24: harden sanitizer.
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
// R-M2 (phase-4): conservative phone regex; previous over-matched dates,
// IPv4 literals, epoch timestamps, and Stripe IDs.
const PHONE_REGEX =
  /\+\d{1,3}[\s.-]\d{2,3}[\s.-]\d{3}[\s.-]\d{3,4}\b|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g
const UUID_REGEX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

export function sanitizeTelemetryErrorMessage(message: unknown): string {
  const redacted = String(message ?? "unknown_error")
    .replace(EMAIL_REGEX, "<redacted_email>")
    .replace(PHONE_REGEX, (match) => {
      const digits = match.replace(/\D/g, "")
      return digits.length >= 7 ? "<redacted_phone>" : match
    })
    .replace(UUID_REGEX, "<entitlement_id>")
  return truncateGraphemes(redacted, 120)
}

// P8: grapheme-aware 120-char truncation.
function truncateGraphemes(input: string, limit: number): string {
  if (input.length <= limit) return input
  const SegmenterCtor = (globalThis as { Intl?: { Segmenter?: unknown } }).Intl
    ?.Segmenter as
    | (new (
        locale?: string,
        options?: { granularity?: string }
      ) => { segment(s: string): Iterable<{ segment: string }> })
    | undefined
  if (typeof SegmenterCtor === "function") {
    // R-M1 (phase-4): count GRAPHEMES, not UTF-16 code units.
    const segmenter = new SegmenterCtor(undefined, { granularity: "grapheme" })
    let out = ""
    let count = 0
    for (const { segment } of segmenter.segment(input)) {
      if (++count > limit) break
      out += segment
    }
    return out
  }
  return Array.from(input).slice(0, limit).join("")
}

const SAVED_KEYS = new Set([
  "provider",
  "market",
  "locale",
  "actor",
  "entitlement_type",
  "entitlement_instance_id",
  "device_class",
  "os_family",
])

const FAILED_KEYS = new Set([
  "provider",
  "market",
  "locale",
  "actor",
  "entitlement_type",
  "entitlement_instance_id",
  "failure_code",
  "error_message",
])

const ALLOWED_FAILURE_CODES = new Set<WalletFailureCode>([
  "provider_error",
  "network",
  "policy_deny",
  "auth_expired",
  "client_error",
])

function whitelistProperties(
  event: "wallet.pass_saved" | "wallet.pass_failed",
  props: Record<string, unknown>
): Record<string, unknown> {
  const allowed = event === "wallet.pass_saved" ? SAVED_KEYS : FAILED_KEYS
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(props)) {
    if (allowed.has(key)) out[key] = props[key]
  }
  return out
}

function captureWalletEvent(
  event: "wallet.pass_saved" | "wallet.pass_failed",
  properties: Record<string, unknown>,
  distinctId: string
): void {
  try {
    const ph = (window as PostHogWindow).posthog
    if (!ph?.capture) return
    // P12: per-counter whitelist before emit.
    const whitelisted = whitelistProperties(event, properties)
    if (event === "wallet.pass_failed") {
      const code = whitelisted.failure_code as WalletFailureCode | undefined
      if (!code || !ALLOWED_FAILURE_CODES.has(code)) return
    }
    // P1: $distinct_id reserved property for backend↔frontend funnel join.
    ph.capture(
      event,
      { ...whitelisted, $distinct_id: distinctId },
      { $distinct_id: distinctId }
    )
  } catch {
    // Telemetry is best-effort; wallet save UX must continue.
  }
}

// R-H4 (phase-4): split semantics. ABSENT (storage API stripped, e.g.
// embedded webviews) -> caller fail-OPENs. FAILED (throw at runtime) ->
// caller fail-CLOSEs.
function readSessionStorage(key: string): string | null {
  if (typeof window === "undefined") return "ABSENT"
  if (!window.sessionStorage) return "ABSENT"
  try {
    return window.sessionStorage.getItem(key) ?? null
  } catch {
    return "FAILED"
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    window.sessionStorage?.setItem(key, value)
  } catch {
    // Best-effort.
  }
}
