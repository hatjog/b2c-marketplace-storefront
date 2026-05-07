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
      <h3 className="text-gp-h5 font-semibold text-gp-neutral-900">{errorHeading}</h3>
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
            className="rounded-gp-md bg-gp-accent-600 px-gp-4 py-gp-2 text-gp-body-sm font-medium text-white hover:bg-gp-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gp-accent-500"
          >
            {retryLabel}
          </button>
        ) : (
          <a
            href={`?retry=${Date.now()}`}
            data-testid="retry-link"
            className="rounded-gp-md bg-gp-accent-600 px-gp-4 py-gp-2 text-gp-body-sm font-medium text-white hover:bg-gp-accent-700"
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
}

export function RecipientAuditTrailTimelineView({
  visibleEvents,
  total,
  remaining,
  showOlderLabel,
  onShowOlder,
}: RecipientAuditTrailTimelineViewProps) {
  const listId = "rat-events-list"

  return (
    <div className="flex flex-col gap-gp-3">
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

      {/* Live region announces list size changes to screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="rat-live-region"
      >
        {`Wyświetlono ${visibleEvents.length} z ${total} wpisów`}
      </div>

      <ol
        id={listId}
        aria-label="Wpisy historii voucheru"
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
export function RecipientAuditTrailPopulatedTimeline({
  events,
  pageSize,
  showOlderLabel,
}: RecipientAuditTrailPopulatedTimelineProps) {
  // events are in ASC order. We display newest first (end of array) initially.
  const total = events.length
  // visibleCount tracks how many events from the END (newest) are shown
  const [visibleCount, setVisibleCount] = useState(Math.min(pageSize, total))

  const visibleEvents = events.slice(total - visibleCount)
  const remaining = total - visibleCount

  const formattedLabel =
    showOlderLabel.replace("{remaining}", String(remaining)) ||
    `Pokaż starsze wpisy (${remaining} pozostało)`

  function handleShowOlder() {
    setVisibleCount((prev) => Math.min(prev + pageSize, total))
  }

  return (
    <RecipientAuditTrailTimelineView
      visibleEvents={visibleEvents}
      total={total}
      remaining={remaining}
      showOlderLabel={formattedLabel}
      onShowOlder={handleShowOlder}
    />
  )
}
