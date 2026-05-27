export type WalletTelemetryProvider = "google" | "apple"
export type WalletTelemetryLocale = "pl-PL" | "en-US" | "uk-UA" | "de-DE"
export type WalletFailureCode = "provider_error" | "network" | "policy_deny"

export type WalletTelemetryCommonProps = {
  provider: WalletTelemetryProvider
  market: string
  locale: WalletTelemetryLocale
  actor: "P4"
  entitlement_type: string
  entitlement_instance_id: string
}

export type WalletSavedClientProps = WalletTelemetryCommonProps

export type WalletFailedClientProps = WalletTelemetryCommonProps & {
  failure_code: WalletFailureCode
  error_message: string
}

type PostHogWindow = Window & {
  posthog?: { capture?: (event: string, properties: Record<string, unknown>) => void }
}

export function emitWalletSaved(props: WalletSavedClientProps): void {
  // F3: SSR / edge runtime guard.
  if (typeof window === "undefined") return

  const storageKey = `wallet_saved_${props.entitlement_instance_id}`
  if (readSessionStorage(storageKey)) return

  captureWalletEvent("wallet.pass_saved", {
    ...props,
    device_class: getDeviceClass(),
    os_family: getOsFamily(),
  })
  writeSessionStorage(storageKey, "1")
}

export function emitWalletFailed(props: WalletFailedClientProps): void {
  if (typeof window === "undefined") return
  captureWalletEvent("wallet.pass_failed", {
    ...props,
    error_message: sanitizeTelemetryErrorMessage(props.error_message),
  })
}

export function getDeviceClass(): "mobile" | "desktop" {
  // F11: SSR guard.
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop"
  }
  if (window.matchMedia?.("(max-width: 768px)").matches) return "mobile"
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    ? "mobile"
    : "desktop"
}

export function getOsFamily(userAgent?: string): "ios" | "android" | "other" {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  if (/Android/i.test(ua)) return "android"
  return "other"
}

export function sanitizeTelemetryErrorMessage(message: unknown): string {
  return String(message ?? "unknown_error")
    .replace(/[\w.-]+@[\w.-]+/g, "<redacted_email>")
    .replace(/\+?\d[\d\s-]{7,}/g, "<redacted_phone>")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "<entitlement_id>"
    )
    .slice(0, 120)
}

function captureWalletEvent(
  event: "wallet.pass_saved" | "wallet.pass_failed",
  properties: Record<string, unknown>
): void {
  try {
    ;(window as PostHogWindow).posthog?.capture?.(event, properties)
  } catch {
    // Telemetry is best-effort; wallet save UX must continue.
  }
}

function readSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    window.sessionStorage?.setItem(key, value)
  } catch {
    // Best-effort: idempotency guard degrades to "may double-emit" if storage
    // is unavailable, which is preferable to dropping the metric.
  }
}
