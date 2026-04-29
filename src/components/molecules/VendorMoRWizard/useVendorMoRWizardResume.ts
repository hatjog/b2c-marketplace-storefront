/**
 * useVendorMoRWizardResume — save-and-resume hook for the vendor MoR wizard
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS sub-story 6.1.d (Tier 1)
 *   §UX-DR3 VendorMoRWizard (multi-step save-and-resume wizard)
 *   §UX-DR6 createPersistedStateMachine() shared utility (cross-component reuse)
 *
 * MVP scope (this story):
 *   - Save & resume against `sessionStorage` keyed per vendor
 *   - Step index + arbitrary draft payload
 *   - SSR-safe: no-ops outside browser (returns initial state)
 *
 * NOT in scope (DEFERRED to follow-up):
 *   - Full multi-step UI shell (form fields, step nav, validation gating)
 *   - useReducer dispatch graph + AR-23 state machine wiring
 *   - Optimistic step transitions / pessimistic final commit (AR-24)
 *   - Migration to shared `createPersistedStateMachine()` once that lands
 */

"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_NAMESPACE = "gp:v150:vendor-mor-wizard"

export interface VendorMoRWizardDraft<TPayload = Record<string, unknown>> {
  /** Zero-based index of the active step */
  stepIndex: number
  /** Free-form draft payload — shape evolves with each follow-up step */
  payload: TPayload
  /** ISO 8601 timestamp of the last save */
  savedAt: string | null
}

export interface UseVendorMoRWizardResumeResult<TPayload = Record<string, unknown>> {
  draft: VendorMoRWizardDraft<TPayload>
  /** Persists `next` and updates the in-memory state */
  save: (next: Partial<VendorMoRWizardDraft<TPayload>>) => void
  /** Drops persisted draft and resets to initial state */
  reset: () => void
  /** True after the first hydration tick (SSR-safe) */
  hydrated: boolean
}

function buildKey(vendorId: string): string {
  return `${STORAGE_NAMESPACE}:${vendorId}`
}

function readDraft<TPayload>(
  vendorId: string,
  initialPayload: TPayload,
): VendorMoRWizardDraft<TPayload> {
  if (typeof window === "undefined") {
    return { stepIndex: 0, payload: initialPayload, savedAt: null }
  }
  try {
    const raw = window.sessionStorage.getItem(buildKey(vendorId))
    if (!raw) {
      return { stepIndex: 0, payload: initialPayload, savedAt: null }
    }
    const parsed = JSON.parse(raw) as Partial<VendorMoRWizardDraft<TPayload>>
    return {
      stepIndex: typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0,
      payload: (parsed.payload ?? initialPayload) as TPayload,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
    }
  } catch {
    // Corrupt JSON — silently reset; never break the wizard render.
    return { stepIndex: 0, payload: initialPayload, savedAt: null }
  }
}

/**
 * Persists the wizard draft per vendor in `sessionStorage` so the operator
 * can resume after an accidental tab close mid-session.
 *
 * Uses `sessionStorage` (NOT `localStorage`) per UX spec §AR-23 + privacy
 * default — drafts MUST NOT survive a closed browser to avoid stale PII.
 */
export function useVendorMoRWizardResume<TPayload = Record<string, unknown>>(
  vendorId: string,
  initialPayload: TPayload,
): UseVendorMoRWizardResumeResult<TPayload> {
  const [draft, setDraft] = useState<VendorMoRWizardDraft<TPayload>>({
    stepIndex: 0,
    payload: initialPayload,
    savedAt: null,
  })
  const [hydrated, setHydrated] = useState(false)

  // Hydrate once on mount (SSR-safe)
  useEffect(() => {
    setDraft(readDraft<TPayload>(vendorId, initialPayload))
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId])

  const save = useCallback(
    (next: Partial<VendorMoRWizardDraft<TPayload>>) => {
      setDraft((prev) => {
        const merged: VendorMoRWizardDraft<TPayload> = {
          stepIndex: next.stepIndex ?? prev.stepIndex,
          payload: (next.payload ?? prev.payload) as TPayload,
          savedAt: new Date().toISOString(),
        }
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(
              buildKey(vendorId),
              JSON.stringify(merged),
            )
          } catch {
            // sessionStorage may be disabled (privacy mode); silent fail
          }
        }
        return merged
      })
    },
    [vendorId],
  )

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(buildKey(vendorId))
      } catch {
        // ignore
      }
    }
    setDraft({ stepIndex: 0, payload: initialPayload, savedAt: null })
  }, [vendorId, initialPayload])

  return { draft, save, reset, hydrated }
}
