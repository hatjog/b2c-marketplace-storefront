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

  it("P10: sessionStorage failures fail-closed (no double-emit on retry)", () => {
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
    // Fail-closed: a throwing storage means "treat as already emitted".
    expect(capture).not.toHaveBeenCalled()
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
})
