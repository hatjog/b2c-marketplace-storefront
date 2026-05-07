/**
 * TimelineItem — micro-primitive for audit-trail timeline UIs
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS sub-story 6.1.b (Tier 1)
 *   §UX-DR1 RecipientAuditTrailTimeline pattern + UX-DR10 audit trail timeline UI
 *
 * Extended by Story v160-cleanup-53 (RecipientAuditTrailTimeline):
 *   - optional `actor` field for vendor/system/recipient visual differentiation
 *
 * Backward-compatible: existing callers without `actor` prop render identically.
 */

import React from "react"
import type { FC, ReactNode } from "react"

export interface TimelineItemActor {
  type: "vendor" | "system" | "recipient"
  label?: string
}

export interface TimelineItemProps {
  /** ISO 8601 timestamp; rendered in monospace */
  timestamp?: string
  /** Short event label */
  title: ReactNode
  /** Optional secondary detail line */
  detail?: ReactNode
  /** Optional status hint — drives dot color via design tokens */
  tone?: "info" | "success" | "warning" | "error"
  /** First node in the list (no top connector line) */
  isFirst?: boolean
  /** Last node in the list (no bottom connector line) */
  isLast?: boolean
  /**
   * Optional actor badge. When present, renders a labelled badge above the
   * title indicating which party performed the action.
   * Added in Story v160-cleanup-53 — optional for full backward-compat.
   */
  actor?: TimelineItemActor
  "data-testid"?: string
}

const TONE_DOT: Record<NonNullable<TimelineItemProps["tone"]>, string> = {
  info: "bg-gp-accent-500",
  success: "bg-gp-flag-active-fg",
  warning: "bg-gp-flag-paused-fg",
  error: "bg-gp-flag-disabled-fg",
}

/** Actor badge token mapping (AC5 — token-driven, zero hex literals) */
const ACTOR_TOKENS: Record<TimelineItemActor["type"], string> = {
  vendor: "bg-gp-accent-100 text-gp-accent-900",
  system: "bg-gp-neutral-100 text-gp-neutral-700",
  recipient: "bg-gp-flag-active-bg text-gp-flag-active-fg",
}

const ACTOR_LABEL_FALLBACK: Record<TimelineItemActor["type"], string> = {
  vendor: "vendor",
  system: "system",
  recipient: "recipient",
}

export const TimelineItem: FC<TimelineItemProps> = ({
  timestamp,
  title,
  detail,
  tone = "info",
  isFirst = false,
  isLast = false,
  actor,
  "data-testid": dataTestId,
}) => {
  return (
    <li
      className="relative flex gap-gp-3 pl-gp-6"
      data-testid={dataTestId ?? "timeline-item"}
      data-tone={tone}
    >
      {/* connector rail (left) */}
      <span
        aria-hidden="true"
        className={`absolute left-gp-2 ${isFirst ? "top-gp-3" : "top-0"} ${
          isLast ? "h-gp-3" : "bottom-0"
        } w-px bg-gp-neutral-200`}
      />
      {/* dot */}
      <span
        aria-hidden="true"
        className={`absolute left-gp-1 top-gp-3 h-gp-2 w-gp-2 rounded-gp-full ${TONE_DOT[tone]}`}
      />
      <div className="flex flex-1 flex-col gap-gp-0.5 pb-gp-4">
        {actor ? (
          <span
            className={`inline-flex w-fit items-center rounded-gp-sm px-gp-2 py-gp-0.5 text-gp-body-sm font-medium ${ACTOR_TOKENS[actor.type]}`}
            data-actor={actor.type}
          >
            {actor.label ?? ACTOR_LABEL_FALLBACK[actor.type]}
          </span>
        ) : null}
        {timestamp ? (
          <time
            dateTime={timestamp}
            className="font-gp-monospace text-gp-body-sm text-gp-neutral-500"
          >
            {timestamp}
          </time>
        ) : null}
        <div className="text-gp-body font-medium text-gp-neutral-900">{title}</div>
        {detail ? (
          <div className="text-gp-body-sm text-gp-neutral-600">{detail}</div>
        ) : null}
      </div>
    </li>
  )
}
