import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  emitWalletFailed,
  emitWalletSaved,
  getDeviceClass,
  getOsFamily,
  sanitizeTelemetryErrorMessage,
} from "./wallet"

const props = {
  provider: "google" as const,
  market: "bonbeauty",
  locale: "pl-PL" as const,
  actor: "P4" as const,
  entitlement_type: "voucher",
  entitlement_instance_id: "ei_storefront_1",
}

describe("storefront wallet telemetry", () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Linux" })
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => store.set(key, value)),
      },
      matchMedia: vi.fn(() => ({ matches: false })),
      posthog: undefined,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("emits pass_saved once per entitlement_instance_id in a session (F7)", () => {
    const capture = vi.fn()
    ;(window as unknown as { posthog: { capture: typeof capture } }).posthog = {
      capture,
    }
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
    } as MediaQueryList)

    emitWalletSaved(props)
    emitWalletSaved(props)

    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith(
      "wallet.pass_saved",
      expect.objectContaining({
        ...props,
        device_class: "mobile",
        os_family: "other",
        // P1: $distinct_id reserved property for backend funnel join.
        $distinct_id: `actor:P4:${props.entitlement_instance_id}`,
      }),
      expect.objectContaining({
        $distinct_id: `actor:P4:${props.entitlement_instance_id}`,
      })
    )
  })

  it("emits sanitized pass_failed without throwing", () => {
    const capture = vi.fn()
    ;(window as unknown as { posthog: { capture: typeof capture } }).posthog = {
      capture,
    }

    emitWalletFailed({
      ...props,
      failure_code: "network",
      error_message: "Failed for anna@example.com +48 501 222 333",
    })

    expect(capture).toHaveBeenCalledWith(
      "wallet.pass_failed",
      expect.objectContaining({
        failure_code: "network",
        error_message: expect.not.stringContaining("anna@example.com"),
      }),
      expect.objectContaining({
        $distinct_id: `actor:P4:${props.entitlement_instance_id}`,
      })
    )
  })

  it("derives device class and OS family", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
    } as MediaQueryList)

    expect(getDeviceClass()).toBe("desktop")
    expect(getOsFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)")).toBe("ios")
    expect(getOsFamily("Mozilla/5.0 Android")).toBe("android")
    expect(getOsFamily("Mozilla/5.0 Linux")).toBe("other")
  })

  it("redacts PII and truncates error messages", () => {
    const message = sanitizeTelemetryErrorMessage(
      "bad john@example.com +48 501 222 333 123e4567-e89b-12d3-a456-426614174000 ".repeat(
        3
      )
    )

    expect(message).not.toContain("john@example.com")
    expect(message).not.toContain("+48")
    expect(message).not.toContain("123e4567")
    expect(message.length).toBeLessThanOrEqual(120)
  })

  it("R-H4 (phase-4): sessionStorage THROW fail-CLOSES (Safari Private Mode)", () => {
    const capture = vi.fn()
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error("QuotaExceededError")
      }),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError")
      }),
    }
    vi.stubGlobal("window", {
      sessionStorage: throwingStorage,
      matchMedia: vi.fn(() => ({ matches: false })),
      posthog: { capture },
    })

    expect(() => emitWalletSaved(props)).not.toThrow()
    // Throwing storage means "treat as already emitted".
    expect(capture).not.toHaveBeenCalled()
    // R-L3 (phase-4): assert capture binding observed via window.posthog so
    // the test cannot trivially pass on a dangling vi.fn.
    expect(
      ((window as unknown as { posthog: { capture: typeof capture } }).posthog
        .capture as unknown) === capture
    ).toBe(true)
  })

  it("R-H4 (phase-4): sessionStorage ABSENT fail-OPENS (embedded webview)", () => {
    const capture = vi.fn()
    vi.stubGlobal("window", {
      sessionStorage: undefined,
      matchMedia: vi.fn(() => ({ matches: false })),
      posthog: { capture },
    })

    expect(() => emitWalletSaved(props)).not.toThrow()
    // Absent storage means "no prior emit" -> the save event must fire so
    // the embedded-webview mobile cohort does not zero out the counter.
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it("P9 / P12: rejects empty error_message and unknown failure_code", () => {
    const capture = vi.fn()
    ;(window as unknown as { posthog: { capture: typeof capture } }).posthog = {
      capture,
    }

    emitWalletFailed({
      ...props,
      failure_code: "network",
      error_message: "",
    })
    expect(capture).not.toHaveBeenCalled()

    emitWalletFailed({
      ...props,
      // @ts-expect-error testing runtime guard
      failure_code: "bogus",
      error_message: "x",
    })
    expect(capture).not.toHaveBeenCalled()
  })

  it("P25: accepts auth_expired and client_error", () => {
    const capture = vi.fn()
    ;(window as unknown as { posthog: { capture: typeof capture } }).posthog = {
      capture,
    }

    emitWalletFailed({
      ...props,
      failure_code: "auth_expired",
      error_message: "session expired",
    })
    emitWalletFailed({
      ...props,
      failure_code: "client_error",
      error_message: "shape mismatch",
    })

    expect(capture).toHaveBeenCalledTimes(2)
  })

  it("R-L7 (phase-4): pins literal redaction tokens", () => {
    expect(sanitizeTelemetryErrorMessage("user@example.com")).toContain(
      "<redacted_email>"
    )
    expect(sanitizeTelemetryErrorMessage("+48 501 222 333")).toContain(
      "<redacted_phone>"
    )
    expect(
      sanitizeTelemetryErrorMessage("123e4567-e89b-12d3-a456-426614174000")
    ).toContain("<entitlement_id>")
  })

  it("R-M2 (phase-4): phone regex does not over-match dates/IPs/timestamps/IDs", () => {
    expect(
      sanitizeTelemetryErrorMessage("at 2026-05-28T18:00:00Z")
    ).not.toContain("<redacted_phone>")
    expect(
      sanitizeTelemetryErrorMessage("from 127.0.0.1:8080")
    ).not.toContain("<redacted_phone>")
    expect(sanitizeTelemetryErrorMessage("ts 1700000000")).not.toContain(
      "<redacted_phone>"
    )
    expect(sanitizeTelemetryErrorMessage("pi_3OAbCdEf1234567890")).not.toContain(
      "<redacted_phone>"
    )
    expect(sanitizeTelemetryErrorMessage("call +48 123 456 789")).toContain(
      "<redacted_phone>"
    )
  })

  it("R-M3 (phase-4): emitWalletFailed drops null/undefined error_message", () => {
    const capture = vi.fn()
    ;(window as unknown as { posthog: { capture: typeof capture } }).posthog = {
      capture,
    }

    emitWalletFailed({
      ...props,
      failure_code: "network",
      // @ts-expect-error testing runtime guard
      error_message: null,
    })
    emitWalletFailed({
      ...props,
      failure_code: "network",
      // @ts-expect-error testing runtime guard
      error_message: undefined,
    })

    expect(capture).not.toHaveBeenCalled()
  })

  it("R-M4 (phase-4): pass_saved skipped on empty id; pass_failed uses anon distinct_id", () => {
    const capture = vi.fn()
    ;(window as unknown as { posthog: { capture: typeof capture } }).posthog = {
      capture,
    }

    emitWalletSaved({ ...props, entitlement_instance_id: "" })
    expect(capture).not.toHaveBeenCalled()

    emitWalletFailed({
      ...props,
      entitlement_instance_id: "",
      failure_code: "client_error",
      error_message: "boom",
    })
    emitWalletFailed({
      ...props,
      entitlement_instance_id: "",
      failure_code: "client_error",
      error_message: "boom2",
    })
    expect(capture).toHaveBeenCalledTimes(2)
    const d1 = capture.mock.calls[0]![1].$distinct_id as string
    const d2 = capture.mock.calls[1]![1].$distinct_id as string
    expect(d1).toMatch(/^actor:P4:anon-/)
    expect(d2).toMatch(/^actor:P4:anon-/)
    expect(d1).not.toBe(d2)
  })
})
