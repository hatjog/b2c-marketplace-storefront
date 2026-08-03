/**
 * AuditTrailEmptyState — empty + first-row state for recipient audit trails
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS sub-story 6.1.b (Tier 1)
 *   §UX-DR1 RecipientAuditTrailTimeline
 *
 * MVP scope (Story 6.1.b):
 *   - Empty state: helpful illustration-free copy + "what to expect" detail
 *   - Populated state: first TimelineItem visible (proof the slot is wired)
 *
 * Full RecipientAuditTrailTimeline component shipped in Story v160-cleanup-53
 * (TF-130) — see GP/storefront/src/components/molecules/RecipientAuditTrailTimeline/.
 *
 * RSC server component by default per AR-23.
 */

import React from "react"
import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"

import { TimelineItem } from "./TimelineItem"

export interface AuditTrailEmptyStateProps {
  /**
   * If at least one audit row exists, render its first row inside the
   * timeline shell. The empty-illustration variant is replaced by the
   * "first row visible" variant.
   */
  firstRow?: {
    timestamp: string
    title: ReactNode
    detail?: ReactNode
    tone?: "info" | "success" | "warning" | "error"
  }
  /** Optional override copy for the empty state heading */
  emptyHeading?: string
  /** Optional override copy for the empty state body */
  emptyBody?: string
  /** data-testid hook */
  "data-testid"?: string
}

export async function AuditTrailEmptyState({
  firstRow,
  emptyHeading,
  emptyBody,
  "data-testid": dataTestId,
}: AuditTrailEmptyStateProps) {
  const t = await getTranslations("audit_trail.empty_state")

  if (firstRow) {
    return (
      <ol
        aria-label={t("populated_aria_label")}
        data-testid={dataTestId ?? "audit-trail-empty-state-populated"}
        data-state="populated"
        className="m-0 list-none p-0"
      >
        <TimelineItem
          timestamp={firstRow.timestamp}
          title={firstRow.title}
          detail={firstRow.detail}
          tone={firstRow.tone ?? "info"}
          isFirst
          isLast
          data-testid="audit-trail-first-row"
        />
      </ol>
    )
  }

  return (
    <div
      role="status"
      aria-label={t("empty_aria_label")}
      data-testid={dataTestId ?? "audit-trail-empty-state-empty"}
      data-state="empty"
      className="flex flex-col gap-gp-2 rounded-gp-md border border-dashed border-gp-neutral-200 bg-gp-neutral-50 p-gp-6 text-gp-neutral-600"
    >
      <h3 className="text-gp-h4 font-semibold text-gp-neutral-900">
        {emptyHeading ?? t("heading")}
      </h3>
      <p className="text-gp-body">{emptyBody ?? t("body")}</p>
    </div>
  )
}
