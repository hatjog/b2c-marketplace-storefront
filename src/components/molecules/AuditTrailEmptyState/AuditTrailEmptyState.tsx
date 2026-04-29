/**
 * AuditTrailEmptyState — empty + first-row state for recipient audit trails
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS sub-story 6.1.b (Tier 1)
 *   §UX-DR1 RecipientAuditTrailTimeline (full component DEFERRED to follow-up)
 *
 * MVP scope (this story):
 *   - Empty state: helpful illustration-free copy + "what to expect" detail
 *   - Populated state: first TimelineItem visible (proof the slot is wired)
 *
 * NOT in scope: live RSC fetch of audit log entries, skeleton matching final
 * layout (Tier 1 requirement deferred), error state, paginated tail. These
 * land alongside the full RecipientAuditTrailTimeline in a follow-up story.
 *
 * RSC server component by default per AR-23.
 */

import type { FC, ReactNode } from "react"
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

const DEFAULT_EMPTY_HEADING = "Brak wpisów w historii"
const DEFAULT_EMPTY_BODY =
  "Tutaj zobaczysz każdą zmianę dotyczącą tego voucheru — kto, kiedy i jaką operację wykonał. Audit trail pojawi się przy pierwszej akcji."

export const AuditTrailEmptyState: FC<AuditTrailEmptyStateProps> = ({
  firstRow,
  emptyHeading,
  emptyBody,
  "data-testid": dataTestId,
}) => {
  if (firstRow) {
    return (
      <ol
        aria-label="Historia audytu"
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
      aria-label="Historia audytu jest pusta"
      data-testid={dataTestId ?? "audit-trail-empty-state-empty"}
      data-state="empty"
      className="flex flex-col gap-gp-2 rounded-gp-md border border-dashed border-gp-neutral-200 bg-gp-neutral-50 p-gp-6 text-gp-neutral-600"
    >
      <h3 className="text-gp-h4 font-semibold text-gp-neutral-900">
        {emptyHeading ?? DEFAULT_EMPTY_HEADING}
      </h3>
      <p className="text-gp-body">{emptyBody ?? DEFAULT_EMPTY_BODY}</p>
    </div>
  )
}
