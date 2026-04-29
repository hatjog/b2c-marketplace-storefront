/**
 * VendorMoRWizard — multi-step save-and-resume wizard SCAFFOLD
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS sub-story 6.1.d (Tier 1)
 *   §UX-DR3 VendorMoRWizard
 *   §UX-DR6 createPersistedStateMachine() shared utility (deferred)
 *   §UX-DR9 Pattern 3 — save-and-resume wizard
 *
 * MVP scope (this story):
 *   - Renders a placeholder shell + uses `useVendorMoRWizardResume` hook
 *   - Surfaces hydrated draft step + last-save timestamp
 *
 * DEFERRED to follow-up (v1.5.1):
 *   - Full multi-step UI (Settlement profile → Tax MoR → Payouts → Review)
 *   - useReducer state machine + per-step validation gating
 *   - Optimistic step transitions; pessimistic final commit (AR-24)
 *   - 4 ACs per John-2 DoD
 *   - Migration to `createPersistedStateMachine()` once Story 2.1 ships it
 *   - AAA selective WCAG 2.2 audit
 */

"use client"

import type { FC } from "react"
import {
  useVendorMoRWizardResume,
  type VendorMoRWizardDraft,
} from "./useVendorMoRWizardResume"

export interface VendorMoRWizardProps {
  /** Vendor scope key — drafts are isolated per vendor */
  vendorId: string
  /** Initial empty payload shape (final shape lands in follow-up) */
  initialPayload?: Record<string, unknown>
  /** data-testid hook */
  "data-testid"?: string
}

const SCAFFOLD_STEPS = [
  "Settlement profile",
  "Tax MoR routing",
  "Payouts",
  "Review",
] as const

export const VendorMoRWizard: FC<VendorMoRWizardProps> = ({
  vendorId,
  initialPayload = {},
  "data-testid": dataTestId,
}) => {
  const { draft, hydrated } = useVendorMoRWizardResume(vendorId, initialPayload)
  const stepLabel = SCAFFOLD_STEPS[draft.stepIndex] ?? SCAFFOLD_STEPS[0]

  return (
    <section
      aria-label="Kreator MoR sprzedawcy (scaffold)"
      data-testid={dataTestId ?? "vendor-mor-wizard"}
      data-hydrated={hydrated ? "true" : "false"}
      className="flex flex-col gap-gp-4 rounded-gp-md border border-gp-neutral-200 bg-gp-neutral-50 p-gp-6"
    >
      <header className="flex items-baseline justify-between gap-gp-3">
        <h2 className="text-gp-h3 font-semibold text-gp-neutral-900">
          {stepLabel}
        </h2>
        <span className="text-gp-body-sm text-gp-neutral-500">
          {`Krok ${draft.stepIndex + 1} z ${SCAFFOLD_STEPS.length}`}
        </span>
      </header>
      <p className="text-gp-body text-gp-neutral-600">
        Pełna implementacja kreatora wieloetapowego trafia do v1.5.1
        (sub-story 6.1.d, deferred per Risk #4 capacity). Ten scaffold
        zaślepa pamięć save-and-resume i kontrakt typów.
      </p>
      {draft.savedAt ? (
        <p className="text-gp-body-sm text-gp-neutral-500">
          {`Wersja robocza zapisana: ${draft.savedAt}`}
        </p>
      ) : null}
    </section>
  )
}

export type { VendorMoRWizardDraft }
