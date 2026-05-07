/**
 * Story v160-cleanup-53 (TF-130) — RecipientAuditTrailTimeline Storybook stories
 *
 * 5 stories per AC6:
 *   1. Empty     — events: []
 *   2. Loading   — loading: true (skeleton shimmer)
 *   3. Error     — error: new Error(...)
 *   4. Populated — 5 events, mixed actor types
 *   5. PaginatedTail — 50 events, "Pokaż starsze wpisy (30 pozostało)" visible
 *
 * NOTE: RecipientAuditTrailTimeline is an async RSC. Storybook renders it as a
 * component that returns JSX for stories — wrap in a client-compatible shim.
 * For Storybook, the component is rendered without next-intl context, so we use
 * a minimal props-override pattern (emptyHeading / emptyBody overrides bypass
 * the t() call path during Storybook render).
 *
 * Since the component is async RSC, Storybook 8+ with experimental RSC support
 * OR a wrapper is needed. For compatibility we export the client-island stories
 * directly for the interactive variants, and use a server-render-compatible
 * approach for static variants.
 */

import type { Meta, StoryObj } from "@storybook/react"

import { RecipientAuditTrailTimelineClient } from "./RecipientAuditTrailTimelineClient"
import type { RecipientAuditTrailEvent } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeEvent(
  id: string,
  timestamp: string,
  title: string,
  actor?: RecipientAuditTrailEvent["actor"],
  tone?: RecipientAuditTrailEvent["tone"],
  description?: string,
): RecipientAuditTrailEvent {
  return { id, timestamp, event_type: "voucher.event", title, actor, tone, description }
}

const SAMPLE_EVENTS: RecipientAuditTrailEvent[] = [
  makeEvent(
    "ev-1",
    "2026-04-01T08:00:00Z",
    "Voucher utworzony",
    { type: "vendor", label: "BBlooms" },
    "success",
    "Wartość: 250.00 PLN",
  ),
  makeEvent(
    "ev-2",
    "2026-04-01T08:05:00Z",
    "Wysłany do odbiorcy",
    { type: "system" },
    "info",
    "Email: anna@example.com",
  ),
  makeEvent(
    "ev-3",
    "2026-04-02T14:30:00Z",
    "Otwarty przez odbiorcę",
    { type: "recipient", label: "Anna K." },
    "info",
  ),
  makeEvent(
    "ev-4",
    "2026-04-05T10:00:00Z",
    "Voucher zrealizowany",
    { type: "recipient", label: "Anna K." },
    "success",
  ),
  makeEvent(
    "ev-5",
    "2026-04-06T09:00:00Z",
    "Potwierdzenie realizacji",
    { type: "vendor", label: "BBlooms" },
    "success",
    "Usługa: Strzyżenie + pielęgnacja",
  ),
]

function makePaginatedEvents(count: number): RecipientAuditTrailEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent(
      `ev-pg-${i + 1}`,
      `2026-0${Math.floor(i / 30) + 1}-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
      `Zdarzenie ${i + 1}`,
      i % 3 === 0 ? { type: "vendor", label: "BBlooms" } : i % 3 === 1 ? { type: "system" } : { type: "recipient", label: "Anna K." },
      "info",
    ),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Storybook meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof RecipientAuditTrailTimelineClient> = {
  title: "Molecules/RecipientAuditTrailTimeline",
  component: RecipientAuditTrailTimelineClient,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof RecipientAuditTrailTimelineClient>

// ─────────────────────────────────────────────────────────────────────────────
// Story 1: Empty state
// ─────────────────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: "Empty",
  render: () => (
    <div className="max-w-lg">
      <div
        role="status"
        aria-label="Historia audytu jest pusta"
        data-testid="audit-trail-empty-state-empty"
        data-state="empty"
        className="flex flex-col gap-2 rounded-md border border-dashed border-gray-200 bg-gray-50 p-6 text-gray-600"
      >
        <h3 className="font-semibold text-gray-900">Brak wpisów w historii voucheru</h3>
        <p className="text-sm">
          Tutaj zobaczysz każdą zmianę dotyczącą tego voucheru — kto, kiedy i jaką operację
          wykonał. Historia pojawi się przy pierwszej akcji vendora lub systemu.
        </p>
        <p className="text-xs text-gray-500">
          Zgodnie z RODO Art. 15, masz prawo wglądu do historii przetwarzania Twoich danych.
        </p>
        <a href="/help/voucher-claim" className="text-sm font-medium text-blue-700 underline">
          Zobacz instrukcje odbioru
        </a>
      </div>
    </div>
  ),
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 2: Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

export const Loading: Story = {
  name: "Loading",
  render: () => (
    <div className="max-w-lg">
      <div
        role="status"
        aria-label="Ładuję historię…"
        data-testid="recipient-audit-trail-loading"
        className="flex flex-col gap-3"
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 pl-6">
            <div className="flex flex-1 flex-col gap-1 pb-4">
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 3: Error state
// ─────────────────────────────────────────────────────────────────────────────

export const Error: Story = {
  name: "Error",
  args: {
    mode: "error",
    errorHeading: "Nie udało się załadować historii",
    errorBody: "Sprawdź połączenie i spróbuj ponownie.",
    errorMessage: "Failed to load audit log: network timeout",
    retryLabel: "Spróbuj ponownie",
    supportLabel: "Kontakt z pomocą",
    supportHref: "/help/contact",
    onRetry: () => alert("Retry triggered"),
  } as Parameters<typeof RecipientAuditTrailTimelineClient>[0],
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 4: Populated — 5 events with mixed actors
// ─────────────────────────────────────────────────────────────────────────────

export const Populated: Story = {
  name: "Populated (5 events, mixed actors)",
  args: {
    mode: "populated",
    events: SAMPLE_EVENTS,
    pageSize: 20,
    showOlderLabel: "Pokaż starsze wpisy ({remaining} pozostało)",
  } as Parameters<typeof RecipientAuditTrailTimelineClient>[0],
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 5: Paginated tail — 50 events
// ─────────────────────────────────────────────────────────────────────────────

export const PaginatedTail: Story = {
  name: "PaginatedTail (50 events, load-more visible)",
  args: {
    mode: "populated",
    events: makePaginatedEvents(50),
    pageSize: 20,
    showOlderLabel: "Pokaż starsze wpisy ({remaining} pozostało)",
  } as Parameters<typeof RecipientAuditTrailTimelineClient>[0],
}
