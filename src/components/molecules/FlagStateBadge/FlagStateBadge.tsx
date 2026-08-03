'use client';

/**
 * FlagStateBadge — ternary visual state widget
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS (Tier 1 component, sub-story 6.1.b)
 *   AC-FLAG-STATE-TERNARY-VISUAL-01 — visual differentiation distinct beyond color
 *   AC-UI-6.1-09 — tap target ≥48×48px (mobile)
 *
 * Three states:
 *   - active   = success (gold accent harmony green); ● solid dot icon
 *   - paused   = warning (muted amber);              ⏸ pause-bars icon (NIE same shade)
 *   - disabled = neutral (muted gray);               ○ hollow dot icon
 *
 * Color-NOT-only meaning: each state pairs an icon + distinct copy + pattern
 * so AC-FLAG-STATE-TERNARY-VISUAL-01 is satisfied (PAUSED ≠ DISABLED via
 * icon shape, not a color shift only).
 *
 * Server component by default (RSC + cache() per AR-23 State Management
 * Decision Tree). NO client interactivity — read-only display.
 *
 * AdminFlagStateBadge variant DEFERRED to v1.5.1 per Path B WN-4 conditional.
 */

import type { FC } from "react"
import { useTranslations } from "next-intl"

export type FlagState = "active" | "paused" | "disabled"

export interface FlagStateBadgeProps {
  /** Ternary state of the operator flag */
  state: FlagState
  /** Optional override label; defaults to localized state copy */
  label?: string
  /** Optional className passthrough */
  className?: string
  /** data-testid hook for tests */
  "data-testid"?: string
}

const STATE_ICON: Record<FlagState, string> = {
  // Distinct shapes — NOT same glyph in different colors.
  active: "●",  // ● solid dot
  paused: "⏸",  // ⏸ pause bars
  disabled: "○", // ○ hollow dot
}

const STATE_TONE: Record<FlagState, string> = {
  active: "bg-gp-flag-active-bg text-gp-flag-active-fg",
  paused: "bg-gp-flag-paused-bg text-gp-flag-paused-fg",
  disabled: "bg-gp-flag-disabled-bg text-gp-flag-disabled-fg",
}

/**
 * Joins class names without bringing in `clsx` for a primitive component
 * (kept minimal — no client deps).
 */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

export const FlagStateBadge: FC<FlagStateBadgeProps> = ({
  state,
  label,
  className,
  "data-testid": dataTestId,
}) => {
  const t = useTranslations("flag_state")
  const copy = label ?? t(`state.${state}`)
  const icon = STATE_ICON[state]
  const tone = STATE_TONE[state]

  return (
    <span
      role="status"
      aria-label={t("aria_label", { state: copy })}
      data-testid={dataTestId ?? `flag-state-badge-${state}`}
      data-state={state}
      className={cn(
        // tap target ≥48×48px per AC-UI-6.1-09 (min-w/min-h enforce)
        "inline-flex min-h-gp-tap-target-min min-w-gp-tap-target-min items-center justify-center gap-gp-2 rounded-gp-md px-gp-3 py-gp-2 text-gp-body-sm font-medium",
        tone,
        className,
      )}
    >
      <span aria-hidden="true" className="text-gp-body">
        {icon}
      </span>
      <span>{copy}</span>
    </span>
  )
}
