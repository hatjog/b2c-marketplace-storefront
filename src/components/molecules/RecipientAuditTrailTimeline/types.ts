/**
 * Shared types for RecipientAuditTrailTimeline
 * Story v160-cleanup-53 (TF-130)
 */

import type { ReactNode } from "react"

export interface RecipientAuditTrailEvent {
  id: string
  /** ISO 8601 timestamp */
  timestamp: string
  /** e.g. "voucher.created", "voucher.delivered", "voucher.opened", "voucher.claimed" */
  event_type: string
  /** User-visible label (translated upstream or via i18n tags) */
  title: ReactNode
  /** Optional secondary description line */
  description?: ReactNode
  /** Actor who performed the action (optional — backward-compat with AR45-scoped events) */
  actor?: {
    type: "vendor" | "system" | "recipient"
    label?: string
  }
  /** Visual tone for the timeline dot */
  tone?: "info" | "success" | "warning" | "error"
}

export interface RecipientAuditTrailTimelineProps {
  events: RecipientAuditTrailEvent[]
  /** BCP47 locale string (e.g. "pl", "en") */
  locale: string
  /** Show loading skeleton when true */
  loading?: boolean
  /** Pass error object to render error state */
  error?: Error | { message: string }
  /** Number of events per page (default 20) */
  pageSize?: number
  /** Retry handler for server-rendered fallback */
  onRetry?: () => void
  /** Override empty state heading */
  emptyHeading?: string
  /** Override empty state body */
  emptyBody?: string
  /** Override CTA href in empty state */
  ctaHref?: string
  "data-testid"?: string
}
