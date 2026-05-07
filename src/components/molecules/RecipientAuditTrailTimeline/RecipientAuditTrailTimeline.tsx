/**
 * RecipientAuditTrailTimeline — full Tier 1 recipient-visible audit trail
 *
 * Story: v160-cleanup-53 (Epic 10, TF-130)
 * UX-DR22: RecipientAuditTrailTimeline — visible audit trail per GDPR Art. 15
 * UX-DR96: Ania recipient persona — M-6 audit trail surface
 *
 * Design constraints:
 *   - RSC default per AR-23 (async function + next-intl/server getTranslations)
 *   - Client island only for pagination + error retry (RecipientAuditTrailTimelineClient)
 *   - Privacy invariant AR45: actor.label may surface vendor name (recipient-side
 *     surface) — does NOT expose recipient PII of other sessions
 *   - Zero hex literals — all colors via design tokens (tailwind.config.*)
 *   - Backward-compat: composes AuditTrailEmptyState (Opcja A, OQ #1)
 *
 * Backend integration (AC8):
 *   Endpoint EXISTS: GET /store/vouchers/:code/events
 *   (Story v160-cleanup-25, route.ts in GP/backend/src/api/store/vouchers/[code]/events/)
 *   Returns: { events: Array<{ id, event_type, occurred_at }> }
 *   AR45-scoped: only event_type + occurred_at + id cross the boundary.
 *   Caller route resolves data and passes as `events` prop.
 *   Note: existing endpoint returns buyer-visible events only (created/sent/opened/claimed/withdrawn).
 *   For full vendor/system/recipient actor segregation (UX-DR22) a richer endpoint
 *   is needed — documented as v1.7.0 backend dependency (story: v170-recipient-audit-events-endpoint).
 *   v1.6.0 ships full UI; actor field optional and defaults gracefully when not present.
 */

import { getTranslations } from "next-intl/server"

import { AuditTrailEmptyState } from "../AuditTrailEmptyState/AuditTrailEmptyState"
import { RecipientAuditTrailTimelineClient } from "./RecipientAuditTrailTimelineClient"
import type { RecipientAuditTrailEvent, RecipientAuditTrailTimelineProps } from "./types"

export type { RecipientAuditTrailEvent, RecipientAuditTrailTimelineProps }

function RecipientAuditTrailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Ładuję historię…"
      data-testid="recipient-audit-trail-loading"
      className="flex flex-col gap-gp-3"
    >
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-gp-3 pl-gp-6">
          <div className="flex flex-1 flex-col gap-gp-1 pb-gp-4">
            <div className="h-gp-3 w-24 animate-pulse rounded-gp-sm bg-gp-neutral-200" />
            <div className="h-gp-4 w-48 animate-pulse rounded-gp-sm bg-gp-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

export async function RecipientAuditTrailTimeline({
  events,
  locale,
  loading = false,
  error,
  pageSize = 20,
  onRetry,
  emptyHeading,
  emptyBody,
  ctaHref,
  "data-testid": dataTestId,
}: RecipientAuditTrailTimelineProps) {
  const t = await getTranslations({ locale, namespace: "voucher.recipient_audit_trail" })

  const heading = t("heading")
  const footerNote = t("footer_note")

  // Loading skeleton
  if (loading) {
    return (
      <section
        aria-labelledby="rat-heading"
        data-testid={dataTestId ?? "recipient-audit-trail"}
        className="flex flex-col gap-gp-4"
      >
        <h2 id="rat-heading" className="text-gp-h4 font-semibold text-gp-neutral-900">
          {heading}
        </h2>
        <RecipientAuditTrailSkeleton />
      </section>
    )
  }

  // Error state — delegate to client island for retry interactivity
  if (error) {
    const errorHeading = t("error.heading")
    const errorBody = t("error.body")
    const retryLabel = t("error.retry_label")
    const supportLabel = t("error.support_label")
    const supportHref = t("error.support_href")
    const errorMessage =
      typeof error === "object" && "message" in error ? error.message : "Unknown error"

    return (
      <section
        aria-labelledby="rat-heading"
        data-testid={dataTestId ?? "recipient-audit-trail"}
        className="flex flex-col gap-gp-4"
      >
        <h2 id="rat-heading" className="text-gp-h4 font-semibold text-gp-neutral-900">
          {heading}
        </h2>
        <RecipientAuditTrailTimelineClient
          mode="error"
          errorHeading={errorHeading}
          errorBody={errorBody}
          errorMessage={errorMessage}
          retryLabel={retryLabel}
          supportLabel={supportLabel}
          supportHref={supportHref}
          onRetry={onRetry}
        />
      </section>
    )
  }

  // Empty state — reuse AuditTrailEmptyState (Opcja A, OQ #1)
  if (events.length === 0) {
    const resolvedEmptyHeading = emptyHeading ?? t("empty.heading")
    const resolvedEmptyBody = emptyBody ?? t("empty.body")

    return (
      <section
        aria-labelledby="rat-heading"
        data-testid={dataTestId ?? "recipient-audit-trail"}
        className="flex flex-col gap-gp-4"
      >
        <h2 id="rat-heading" className="text-gp-h4 font-semibold text-gp-neutral-900">
          {heading}
        </h2>
        <AuditTrailEmptyState
          emptyHeading={resolvedEmptyHeading}
          emptyBody={resolvedEmptyBody}
          data-testid="recipient-audit-trail-empty"
        />
        <a
          href={ctaHref ?? t("empty.cta_href")}
          className="text-gp-body-sm font-medium text-gp-accent-700 underline hover:text-gp-accent-900"
          aria-label={t("empty.cta_label")}
        >
          {t("empty.cta_label")}
        </a>
      </section>
    )
  }

  // Populated — delegate to client island for pagination
  // Defensive sort: ASC chronological (oldest first) per AC1 spec
  const ordered = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const showOlderLabel = t("pagination.show_older")

  return (
    <section
      aria-labelledby="rat-heading"
      data-testid={dataTestId ?? "recipient-audit-trail"}
      className="flex flex-col gap-gp-4"
    >
      <h2 id="rat-heading" className="text-gp-h4 font-semibold text-gp-neutral-900">
        {heading}
      </h2>
      <RecipientAuditTrailTimelineClient
        mode="populated"
        events={ordered}
        pageSize={pageSize}
        showOlderLabel={showOlderLabel}
      />
      <p className="text-gp-body-xs text-gp-neutral-500">{footerNote}</p>
    </section>
  )
}
