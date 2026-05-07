"use client"

/**
 * RecipientAuditTrailTimelineClient — client island for:
 *   1. Paginated load-more (useState — no full-page reload)
 *   2. Error retry handler
 *
 * Story v160-cleanup-53 (TF-130)
 * Pure presentational client component — no server imports, no node:* modules.
 * Barrel leak guard: MUST NOT import any server-only modules.
 * React explicit import required for vitest node environment JSX evaluation.
 */

import React, { useState } from "react"

import { TimelineItem } from "../AuditTrailEmptyState/TimelineItem"
import type { RecipientAuditTrailEvent } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RecipientAuditTrailErrorStateProps {
  errorHeading: string
  errorBody: string
  errorMessage: string
  retryLabel: string
  supportLabel: string
  supportHref: string
  onRetry?: () => void
}

export interface RecipientAuditTrailPopulatedTimelineProps {
  events: RecipientAuditTrailEvent[]
  pageSize: number
  showOlderLabel: string
  /** Translated aria-label for the ordered list (locale-aware). */
  listAriaLabel?: string
  /**
   * Translated live region template. Supports `{visible}` and `{total}`
   * placeholders.
   */
  liveRegionTemplate?: string
  /**
   * Stable id prefix to avoid duplicate IDs across instances on the same
   * page.
   */
  idPrefix?: string
}

interface ErrorModeProps extends RecipientAuditTrailErrorStateProps {
  mode: "error"
}

interface PopulatedModeProps extends RecipientAuditTrailPopulatedTimelineProps {
  mode: "populated"
}

type RecipientAuditTrailTimelineClientProps = ErrorModeProps | PopulatedModeProps

// ─────────────────────────────────────────────────────────────────────────────
// Main dispatcher — RSC caller renders this as the client island entry point
// ─────────────────────────────────────────────────────────────────────────────

export function RecipientAuditTrailTimelineClient(
  props: RecipientAuditTrailTimelineClientProps,
) {
  if (props.mode === "error") {
    const { mode: _mode, ...rest } = props
    return <RecipientAuditTrailErrorState {...rest} />
  }
  const { mode: _mode, ...rest } = props
  return <RecipientAuditTrailPopulatedTimeline {...rest} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Error state — exported for direct testing
// ─────────────────────────────────────────────────────────────────────────────

export function RecipientAuditTrailErrorState({
  errorHeading,
  errorBody,
  errorMessage,
  retryLabel,
  supportLabel,
  supportHref,
  onRetry,
}: RecipientAuditTrailErrorStateProps) {
  // Sanitize error message — do NOT surface stack traces or PII
  const safeMessage =
    errorMessage && errorMessage.length <= 200
      ? errorMessage
      : "Wystąpił błąd podczas ładowania historii."

  return (
    <div
      role="alert"
      data-testid="recipient-audit-trail-error"
      className="flex flex-col gap-gp-3 rounded-gp-md border border-gp-flag-disabled-fg bg-gp-flag-disabled-bg p-gp-6"
    >
      <h3 className="text-gp-h4 font-semibold text-gp-neutral-900">{errorHeading}</h3>
      <p className="text-gp-body text-gp-neutral-700">{errorBody}</p>
      {safeMessage ? (
        <p className="text-gp-body-sm text-gp-neutral-500" data-testid="error-message">
          {safeMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-gp-3">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            data-testid="retry-button"
            className="rounded-gp-md bg-gp-accent-700 px-gp-4 py-gp-2 text-gp-body-sm font-medium text-gp-neutral-0 hover:bg-gp-accent-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gp-accent-500"
          >
            {retryLabel}
          </button>
        ) : (
          <a
            href={`?retry=${Date.now()}`}
            data-testid="retry-link"
            className="rounded-gp-md bg-gp-accent-700 px-gp-4 py-gp-2 text-gp-body-sm font-medium text-gp-neutral-0 hover:bg-gp-accent-900"
          >
            {retryLabel}
          </a>
        )}
        <a
          href={supportHref}
          data-testid="support-link"
          className="rounded-gp-md border border-gp-neutral-300 px-gp-4 py-gp-2 text-gp-body-sm font-medium text-gp-neutral-700 hover:bg-gp-neutral-50"
        >
          {supportLabel}
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Populated timeline with pagination — exported for direct testing
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Pure view for timeline list — stateless, testable without hooks
// ─────────────────────────────────────────────────────────────────────────────

export interface RecipientAuditTrailTimelineViewProps {
  /** Subset of events to display (already sliced by caller) */
  visibleEvents: RecipientAuditTrailEvent[]
  /** Total event count (for live region announcement) */
  total: number
  /** Remaining hidden events count (0 = hide button) */
  remaining: number
  /** Label for the load-more button (pre-formatted with count) */
  showOlderLabel: string
  /** Click handler for load-more button */
  onShowOlder?: () => void
  /** Translated aria-label for the ordered list (locale-aware). */
  listAriaLabel?: string
  /**
   * Translated live region template. Supports `{visible}` and `{total}`
   * placeholders. Defaults to a Polish string for backward-compat.
   */
  liveRegionTemplate?: string
  /**
   * Stable id prefix to avoid duplicate IDs across instances on the same
   * page. Defaults to "rat".
   */
  idPrefix?: string
}

const DEFAULT_LIST_ARIA_LABEL = "Wpisy historii voucheru"
const DEFAULT_LIVE_TEMPLATE = "Wyświetlono {visible} z {total} wpisów"

export function RecipientAuditTrailTimelineView({
  visibleEvents,
  total,
  remaining,
  showOlderLabel,
  onShowOlder,
  listAriaLabel,
  liveRegionTemplate,
  idPrefix = "rat",
}: RecipientAuditTrailTimelineViewProps) {
  const listId = `${idPrefix}-events-list`
  const template = liveRegionTemplate ?? DEFAULT_LIVE_TEMPLATE
  const liveRegionText = template
    .replace("{visible}", String(visibleEvents.length))
    .replace("{total}", String(total))

  return (
    <div className="flex flex-col gap-gp-3">
      {/* Live region announces list size changes to screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="rat-live-region"
      >
        {liveRegionText}
      </div>

      <ol
        id={listId}
        aria-label={listAriaLabel ?? DEFAULT_LIST_ARIA_LABEL}
        data-testid="recipient-audit-trail-list"
        className="m-0 list-none p-0"
      >
        {visibleEvents.map((event, idx) => (
          <TimelineItem
            key={event.id}
            timestamp={event.timestamp}
            title={event.title}
            detail={event.description}
            tone={event.tone ?? "info"}
            actor={event.actor}
            isFirst={idx === 0}
            isLast={idx === visibleEvents.length - 1}
            data-testid={`audit-event-${event.id}`}
          />
        ))}
      </ol>

      {/* Load-more button — placed BELOW the list per AC4 spec */}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={onShowOlder}
          aria-controls={listId}
          data-testid="show-older-button"
          className="self-start rounded-gp-md border border-gp-neutral-300 px-gp-4 py-gp-2 text-gp-body-sm font-medium text-gp-neutral-700 hover:bg-gp-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gp-accent-500"
        >
          {showOlderLabel}
        </button>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stateful wrapper — pagination state, exported for completeness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pagination UX (AC4):
 *   - Events passed in ASC order (oldest first) from RSC
 *   - Initial view shows LAST pageSize events (newest-first visible window)
 *   - "Pokaż starsze wpisy" progressively reveals older batches above
 *   - When all events visible, button disappears
 *   - a11y: button aria-controls → ol id; live region announces count change
 */
/**
 * Pure pagination math — exported for unit testing AC7(c) without invoking
 * the React renderer (vitest node env cannot host React hooks).
 */
export function computePaginationSlice(
  events: RecipientAuditTrailEvent[],
  pageSize: number,
  visibleCount: number,
): { visibleEvents: RecipientAuditTrailEvent[]; remaining: number; total: number } {
  const total = events.length
  const cappedVisible = Math.min(Math.max(visibleCount, 0), total)
  return {
    visibleEvents: events.slice(total - cappedVisible),
    remaining: total - cappedVisible,
    total,
  }
}

/** Pure reducer — exported for unit testing the load-more transition. */
export function reduceShowOlder(
  prev: number,
  pageSize: number,
  total: number,
): number {
  return Math.min(prev + pageSize, total)
}

export function RecipientAuditTrailPopulatedTimeline({
  events,
  pageSize,
  showOlderLabel,
  listAriaLabel,
  liveRegionTemplate,
  idPrefix,
}: RecipientAuditTrailPopulatedTimelineProps) {
  // events are in ASC order. We display newest first (end of array) initially.
  const total = events.length
  // visibleCount tracks how many events from the END (newest) are shown
  const [visibleCount, setVisibleCount] = useState(Math.min(pageSize, total))

  const { visibleEvents, remaining } = computePaginationSlice(
    events,
    pageSize,
    visibleCount,
  )

  // F11: do not fall back to a hardcoded Polish string when the caller passes
  // an empty template. The button is hidden when remaining === 0, so an empty
  // label is never user-visible.
  const formattedLabel = showOlderLabel.replace("{remaining}", String(remaining))

  function handleShowOlder() {
    setVisibleCount((prev) => reduceShowOlder(prev, pageSize, total))
  }

  return (
    <RecipientAuditTrailTimelineView
      visibleEvents={visibleEvents}
      total={total}
      remaining={remaining}
      showOlderLabel={formattedLabel}
      onShowOlder={handleShowOlder}
      listAriaLabel={listAriaLabel}
      liveRegionTemplate={liveRegionTemplate}
      idPrefix={idPrefix}
    />
  )
}
