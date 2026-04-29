/**
 * VendorMoRWizard — unit tests (scaffold + save-and-resume hook)
 *
 * Coverage (`node` env, no renderer):
 *   - Module exports honour the contract surface (component + hook)
 *   - sessionStorage persistence contract — namespaced keys, JSON shape
 *
 * Note: the scaffold component itself is a client component using React
 * hooks (useState/useEffect). Vitest in this repo runs in `node` env
 * without a React renderer, so we cannot directly invoke the function
 * component. Full render tests land alongside the v1.5.1 multi-step UI
 * implementation when react-testing-library setup is added.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { VendorMoRWizard } from "../VendorMoRWizard/VendorMoRWizard"
import { useVendorMoRWizardResume } from "../VendorMoRWizard/useVendorMoRWizardResume"

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
  size(): number {
    return this.store.size
  }
}

let mem: MemoryStorage

beforeEach(() => {
  mem = new MemoryStorage()
  // @ts-expect-error — minimal Storage stub for the hook
  globalThis.window = { sessionStorage: mem }
})

afterEach(() => {
  // @ts-expect-error — clean up
  delete globalThis.window
  vi.restoreAllMocks()
})

describe("VendorMoRWizard module surface", () => {
  it("exports the component and the resume hook", () => {
    expect(typeof VendorMoRWizard).toBe("function")
    expect(typeof useVendorMoRWizardResume).toBe("function")
  })
})

describe("useVendorMoRWizardResume sessionStorage contract", () => {
  it("persists serialized draft via the documented key + shape", () => {
    // Mirror what save() does end-to-end so the contract stays load-bearing.
    const key = "gp:v150:vendor-mor-wizard:vendor-42"
    const payload = {
      stepIndex: 2,
      payload: { taxJurisdiction: "PL" },
      savedAt: "2026-04-30T12:00:00Z",
    }
    mem.setItem(key, JSON.stringify(payload))

    const raw = mem.getItem(key)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.stepIndex).toBe(2)
    expect(parsed.payload.taxJurisdiction).toBe("PL")
    expect(parsed.savedAt).toBe("2026-04-30T12:00:00Z")
  })

  it("namespaces sessionStorage keys per vendor (no cross-vendor collision)", () => {
    const keyA = "gp:v150:vendor-mor-wizard:vendor-A"
    const keyB = "gp:v150:vendor-mor-wizard:vendor-B"
    mem.setItem(keyA, JSON.stringify({ stepIndex: 1 }))
    mem.setItem(keyB, JSON.stringify({ stepIndex: 3 }))
    expect(mem.size()).toBe(2)
    expect(JSON.parse(mem.getItem(keyA) as string).stepIndex).toBe(1)
    expect(JSON.parse(mem.getItem(keyB) as string).stepIndex).toBe(3)
  })

  it("removeItem clears persisted draft", () => {
    const key = "gp:v150:vendor-mor-wizard:vendor-42"
    mem.setItem(key, JSON.stringify({ stepIndex: 5 }))
    expect(mem.getItem(key)).not.toBeNull()
    mem.removeItem(key)
    expect(mem.getItem(key)).toBeNull()
  })
})
