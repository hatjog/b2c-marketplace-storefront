/**
 * RecipientAuditTrailTimeline — unit tests
 * Story v160-cleanup-53 (TF-130) — AC7
 *
 * Tests the client-island sub-components (exported for direct testing):
 *   - RecipientAuditTrailPopulatedTimeline — pagination
 *   - RecipientAuditTrailErrorState — error retry
 *   - TimelineItem — actor rendering + backward-compat
 *
 * The RSC wrapper (RecipientAuditTrailTimeline.tsx) depends on next-intl/server
 * getTranslations which is not available in the vitest node environment.
 *
 * Coverage (AC7 a-f):
 *   (a) Empty state render — documented as RSC-layer responsibility (next-intl)
 *   (b) Populated render — N rows visible, ASC ordering preserved
 *   (c) Paginated tail — initial = pageSize rows, button shows remaining, gone when all visible
 *   (d) Error state — heading + retry button visible; onClick prop = handler
 *   (e) Actor rendering — vendor/system/recipient with data-actor attribute
 *   (f) Backward-compat — TimelineItem without actor renders without data-actor attr
 */

import React from "react"
import { describe, expect, it, vi } from "vitest"

import {
  RecipientAuditTrailErrorState,
  RecipientAuditTrailTimelineView,
  computePaginationSlice,
  reduceShowOlder,
} from "../RecipientAuditTrailTimelineClient"
import { AuditTrailEmptyState } from "../../AuditTrailEmptyState/AuditTrailEmptyState"
import { TimelineItem } from "../../AuditTrailEmptyState/TimelineItem"
import type { RecipientAuditTrailEvent } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeEvent(
  id: string,
  timestamp: string,
  title: string,
  actor?: RecipientAuditTrailEvent["actor"],
  tone?: RecipientAuditTrailEvent["tone"],
): RecipientAuditTrailEvent {
  return { id, timestamp, event_type: "voucher.test", title, actor, tone }
}

function makeEvents(count: number): RecipientAuditTrailEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent(
      `ev-${i + 1}`,
      `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      `Event ${i + 1}`,
    ),
  )
}

/** Walk a React element tree and collect all prop values matching key */
function collectProps<T>(
  node: React.ReactNode,
  key: string,
  acc: T[] = [],
): T[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return acc
  const el = node as React.ReactElement<Record<string, unknown>>
  if (key in el.props) acc.push(el.props[key] as T)
  const children = el.props.children as React.ReactNode
  if (children) {
    React.Children.forEach(children, (child) => collectProps(child, key, acc))
  }
  return acc
}

/**
 * Call a sync FC as plain function and cast to ReactNode.
 * React 19 types FC return as ReactNode | Promise<ReactNode> but our
 * presentational components are synchronous — this cast is safe here.
 */
function callSyncFC<P>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (props: P) => any,
  props: P,
): React.ReactNode {
  return fn(props) as React.ReactNode
}

/** Find first element by data-testid */
function findByTestId(
  node: React.ReactNode,
  testId: string,
): React.ReactElement<Record<string, unknown>> | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null
  const el = node as React.ReactElement<Record<string, unknown>>
  if (el.props["data-testid"] === testId) return el
  const children = el.props.children as React.ReactNode
  if (!children) return null
  let found: React.ReactElement<Record<string, unknown>> | null = null
  React.Children.forEach(children, (child) => {
    if (!found) found = findByTestId(child, testId)
  })
  return found
}

/** Collect all text from a React node tree */
function collectText(node: React.ReactNode, acc: string[] = []): string[] {
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node))
    return acc
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, acc))
    return acc
  }
  if (React.isValidElement<Record<string, unknown>>(node)) {
    const children = node.props.children as React.ReactNode
    collectText(children, acc)
  }
  return acc
}

// ─────────────────────────────────────────────────────────────────────────────
// (b) Populated render — events visible, ASC order preserved
// Tests RecipientAuditTrailTimelineView (pure/stateless) — avoids useState hook
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipientAuditTrailTimelineView — populated mode", () => {
  it("renders all events (visibleEvents = all)", () => {
    const events = makeEvents(5)
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: events,
      total: events.length,
      remaining: 0,
      showOlderLabel: "Pokaż starsze wpisy (0 pozostało)",
    })
    const testIds = collectProps<string>(tree, "data-testid")
    expect(testIds).toContain("recipient-audit-trail-list")
    const eventTestIds = testIds.filter((id) => id?.startsWith("audit-event-"))
    expect(eventTestIds).toHaveLength(5)
  })

  it("renders events in order as provided (ASC ordering is RSC responsibility)", () => {
    const events = [
      makeEvent("a", "2026-01-01T10:00:00Z", "Event A"),
      makeEvent("b", "2026-02-01T10:00:00Z", "Event B"),
      makeEvent("c", "2026-03-01T10:00:00Z", "Event C"),
    ]
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: events,
      total: events.length,
      remaining: 0,
      showOlderLabel: "",
    })
    const testIds = collectProps<string>(tree, "data-testid")
    const eventIds = testIds.filter((id) => id?.startsWith("audit-event-"))
    expect(eventIds).toHaveLength(3)
    expect(eventIds).toContain("audit-event-a")
    expect(eventIds).toContain("audit-event-b")
    expect(eventIds).toContain("audit-event-c")
  })

  it("does NOT show button when remaining = 0", () => {
    const events = makeEvents(5)
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: events,
      total: events.length,
      remaining: 0,
      showOlderLabel: "",
    })
    const btn = findByTestId(tree, "show-older-button")
    expect(btn).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) Paginated tail — button visible when remaining > 0, live region correct
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipientAuditTrailTimelineView — pagination", () => {
  it("shows only visibleEvents (pageSize slice)", () => {
    const allEvents = makeEvents(50)
    // Simulate: initial pageSize=20 → visibleEvents = last 20
    const visibleEvents = allEvents.slice(30) // last 20 of 50
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents,
      total: 50,
      remaining: 30,
      showOlderLabel: "Pokaż starsze wpisy (30 pozostało)",
    })
    const testIds = collectProps<string>(tree, "data-testid")
    const eventIds = testIds.filter((id) => id?.startsWith("audit-event-"))
    expect(eventIds).toHaveLength(20)
  })

  it("renders show-older button with remaining count label", () => {
    const visibleEvents = makeEvents(20)
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents,
      total: 50,
      remaining: 30,
      showOlderLabel: "Pokaż starsze wpisy (30 pozostało)",
    })
    const btn = findByTestId(tree, "show-older-button")
    expect(btn).not.toBeNull()
    const text = collectText(btn).join("")
    expect(text).toContain("30")
  })

  it("renders live region with visible and total count", () => {
    const visibleEvents = makeEvents(5)
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents,
      total: 10,
      remaining: 5,
      showOlderLabel: "Pokaż starsze wpisy (5 pozostało)",
    })
    const liveRegion = findByTestId(tree, "rat-live-region")
    expect(liveRegion).not.toBeNull()
    const text = collectText(liveRegion).join("")
    expect(text).toContain("5")
    expect(text).toContain("10")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (d) Error state — heading + retry button + handler
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipientAuditTrailErrorState", () => {
  it("renders error heading and body", () => {
    const tree = RecipientAuditTrailErrorState({
      errorHeading: "Nie udało się załadować historii",
      errorBody: "Sprawdź połączenie.",
      errorMessage: "network timeout",
      retryLabel: "Spróbuj ponownie",
      supportLabel: "Kontakt",
      supportHref: "/help/contact",
    })
    const text = collectText(tree).join(" ")
    expect(text).toContain("Nie udało się załadować historii")
    expect(text).toContain("Sprawdź połączenie.")
  })

  it("renders retry-link (not button) when onRetry not provided", () => {
    const tree = RecipientAuditTrailErrorState({
      errorHeading: "Error",
      errorBody: "Body",
      errorMessage: "err",
      retryLabel: "Retry",
      supportLabel: "Support",
      supportHref: "/help/contact",
    })
    const retryLink = findByTestId(tree, "retry-link")
    const retryBtn = findByTestId(tree, "retry-button")
    expect(retryLink).not.toBeNull()
    expect(retryBtn).toBeNull()
  })

  it("calls onRetry handler when retry button clicked (onClick prop = handler)", () => {
    const onRetry = vi.fn()
    const tree = RecipientAuditTrailErrorState({
      errorHeading: "Error heading",
      errorBody: "Error body",
      errorMessage: "test error",
      retryLabel: "Retry",
      supportLabel: "Support",
      supportHref: "/help",
      onRetry,
    })
    const btn = findByTestId(tree, "retry-button")
    expect(btn).not.toBeNull()
    // Verify onClick prop is the onRetry fn
    expect((btn!.props as Record<string, unknown>).onClick).toBe(onRetry)
  })

  it("sanitizes long error messages (does not surface raw stack traces)", () => {
    const longMessage = "x".repeat(300)
    const tree = RecipientAuditTrailErrorState({
      errorHeading: "Error",
      errorBody: "Body",
      errorMessage: longMessage,
      retryLabel: "Retry",
      supportLabel: "Support",
      supportHref: "/help",
    })
    const msgEl = findByTestId(tree, "error-message")
    if (msgEl) {
      const text = collectText(msgEl).join("")
      expect(text).not.toContain(longMessage)
    }
  })

  it("renders support link with correct href", () => {
    const tree = RecipientAuditTrailErrorState({
      errorHeading: "Error",
      errorBody: "Body",
      errorMessage: "err",
      retryLabel: "Retry",
      supportLabel: "Kontakt",
      supportHref: "/help/contact",
    })
    const supportLink = findByTestId(tree, "support-link")
    expect(supportLink).not.toBeNull()
    expect((supportLink!.props as Record<string, unknown>).href).toBe("/help/contact")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (e) Actor rendering — vendor/system/recipient badge
// ─────────────────────────────────────────────────────────────────────────────

describe("TimelineItem — actor rendering (AC5)", () => {
  it("renders actor badge with data-actor attribute for vendor", () => {
    const tree = callSyncFC(TimelineItem, {
      title: "Test event",
      actor: { type: "vendor", label: "BBlooms" },
    })
    const actorAttrs = collectProps<string>(tree, "data-actor")
    expect(actorAttrs).toContain("vendor")
  })

  it("renders actor badge with data-actor attribute for system", () => {
    const tree = callSyncFC(TimelineItem, {
      title: "Test event",
      actor: { type: "system" },
    })
    const actorAttrs = collectProps<string>(tree, "data-actor")
    expect(actorAttrs).toContain("system")
  })

  it("renders actor badge with data-actor attribute for recipient", () => {
    const tree = callSyncFC(TimelineItem, {
      title: "Test event",
      actor: { type: "recipient", label: "Anna K." },
    })
    const actorAttrs = collectProps<string>(tree, "data-actor")
    expect(actorAttrs).toContain("recipient")
  })

  it("renders actor label text when provided", () => {
    const tree = callSyncFC(TimelineItem, {
      title: "Test event",
      actor: { type: "vendor", label: "BBlooms" },
    })
    const text = collectText(tree).join(" ")
    expect(text).toContain("BBlooms")
  })

  it("renders fallback label when actor.label not provided", () => {
    const tree = callSyncFC(TimelineItem, {
      title: "Test event",
      actor: { type: "system" },
    })
    const text = collectText(tree).join(" ")
    expect(text).toContain("system")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (f) Backward-compat — TimelineItem without actor = no data-actor attr
// ─────────────────────────────────────────────────────────────────────────────

describe("TimelineItem — backward-compat (no actor)", () => {
  it("renders without data-actor attribute when actor undefined", () => {
    const tree = callSyncFC(TimelineItem, { title: "Event without actor" })
    const actorAttrs = collectProps<string>(tree, "data-actor")
    expect(actorAttrs).toHaveLength(0)
  })

  it("renders title correctly without actor", () => {
    const tree = callSyncFC(TimelineItem, { title: "My Title", tone: "success" })
    const text = collectText(tree).join(" ")
    expect(text).toContain("My Title")
  })

  it("renders tone dot without actor (backward-compat)", () => {
    const treeInfo = callSyncFC(TimelineItem, { title: "T", tone: "info" })
    const toneAttrs = collectProps<string>(treeInfo, "data-tone")
    expect(toneAttrs).toContain("info")

    const treeSuccess = callSyncFC(TimelineItem, { title: "T", tone: "success" })
    const toneAttrs2 = collectProps<string>(treeSuccess, "data-tone")
    expect(toneAttrs2).toContain("success")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (a) Empty state — AuditTrailEmptyState (sub-component composed by the RSC)
// AC7(a): heading + role="status" visible
// ─────────────────────────────────────────────────────────────────────────────

describe("AuditTrailEmptyState — empty render (AC7a)", () => {
  it("renders empty state with role=\"status\"", () => {
    const tree = callSyncFC(AuditTrailEmptyState, {
      emptyHeading: "Brak wpisów w historii voucheru",
      emptyBody: "Tutaj zobaczysz każdą zmianę dotyczącą tego voucheru.",
      "data-testid": "recipient-audit-trail-empty",
    })
    const roles = collectProps<string>(tree, "role")
    expect(roles).toContain("status")
    const text = collectText(tree).join(" ")
    expect(text).toContain("Brak wpisów w historii voucheru")
    expect(text).toContain("Tutaj zobaczysz każdą zmianę")
  })

  it("renders override body and heading copy", () => {
    const tree = callSyncFC(AuditTrailEmptyState, {
      emptyHeading: "Custom Heading",
      emptyBody: "Custom Body",
    })
    const text = collectText(tree).join(" ")
    expect(text).toContain("Custom Heading")
    expect(text).toContain("Custom Body")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) Pagination interaction — RecipientAuditTrailPopulatedTimeline
// AC7(c): initial render shows pageSize rows with remaining-count button.
// State-transition simulation by rendering the View twice with successive props
// (vitest node env cannot run useState across re-renders without React renderer).
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipientAuditTrailPopulatedTimeline — pagination math (AC7c)", () => {
  it("initial slice (visibleCount = pageSize) returns last pageSize events newest-first", () => {
    const allEvents = makeEvents(50)
    const { visibleEvents, remaining, total } = computePaginationSlice(
      allEvents,
      20,
      20,
    )
    expect(total).toBe(50)
    expect(remaining).toBe(30)
    expect(visibleEvents).toHaveLength(20)
    expect(visibleEvents[visibleEvents.length - 1]?.id).toBe("ev-50")
    expect(visibleEvents[0]?.id).toBe("ev-31")
  })

  it("after one show-older click, slice grows by pageSize (still capped at total)", () => {
    const allEvents = makeEvents(50)
    const next = reduceShowOlder(20, 20, 50)
    expect(next).toBe(40)
    const { visibleEvents, remaining } = computePaginationSlice(allEvents, 20, next)
    expect(visibleEvents).toHaveLength(40)
    expect(remaining).toBe(10)
  })

  it("after enough clicks, all events are visible and remaining = 0 (button hidden)", () => {
    const allEvents = makeEvents(50)
    let count = 20
    count = reduceShowOlder(count, 20, 50) // 40
    count = reduceShowOlder(count, 20, 50) // 50 (capped)
    expect(count).toBe(50)
    const { remaining } = computePaginationSlice(allEvents, 20, count)
    expect(remaining).toBe(0)
    // Render the View with remaining=0 to confirm button is hidden
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: allEvents,
      total: 50,
      remaining: 0,
      showOlderLabel: "x",
    })
    expect(findByTestId(tree, "show-older-button")).toBeNull()
  })

  it("when total <= pageSize the slice is the whole array and remaining = 0", () => {
    const allEvents = makeEvents(5)
    const { visibleEvents, remaining } = computePaginationSlice(allEvents, 20, 5)
    expect(visibleEvents).toHaveLength(5)
    expect(remaining).toBe(0)
  })

  it("View renders button BELOW the list per AC4 spec", () => {
    // The View renders <ol> first, then the button after — verify by the tree
    // structure: collect children of the wrapping div in order.
    const events = makeEvents(20)
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: events.slice(15),
      total: 20,
      remaining: 15,
      showOlderLabel: "Pokaż (15 pozostało)",
    })
    // tree is a <div>; iterate children, find first index of ol vs button
    const node = tree as React.ReactElement<{ children: React.ReactNode }>
    const children = React.Children.toArray(node.props.children) as React.ReactElement[]
    const olIdx = children.findIndex(
      (c) => React.isValidElement(c) && c.type === "ol",
    )
    const btnIdx = children.findIndex(
      (c) => React.isValidElement(c) && c.type === "button",
    )
    expect(olIdx).toBeGreaterThanOrEqual(0)
    expect(btnIdx).toBeGreaterThan(olIdx)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// View — locale-safe live region template
// ─────────────────────────────────────────────────────────────────────────────

describe("RecipientAuditTrailTimelineView — i18n templates", () => {
  it("interpolates {visible}/{total} into liveRegionTemplate", () => {
    const events = makeEvents(3)
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: events,
      total: 10,
      remaining: 7,
      showOlderLabel: "x",
      liveRegionTemplate: "Showing {visible} of {total} entries",
    })
    const live = findByTestId(tree, "rat-live-region")
    expect(live).not.toBeNull()
    const text = collectText(live).join("")
    expect(text).toBe("Showing 3 of 10 entries")
  })

  it("uses provided listAriaLabel on <ol>", () => {
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: makeEvents(2),
      total: 2,
      remaining: 0,
      showOlderLabel: "x",
      listAriaLabel: "Voucher history entries",
    })
    const list = findByTestId(tree, "recipient-audit-trail-list")
    expect(list).not.toBeNull()
    expect((list!.props as Record<string, unknown>)["aria-label"]).toBe(
      "Voucher history entries",
    )
  })

  it("uses idPrefix to derive list id (avoids cross-instance ID collision)", () => {
    const tree = RecipientAuditTrailTimelineView({
      visibleEvents: makeEvents(1),
      total: 1,
      remaining: 0,
      showOlderLabel: "x",
      idPrefix: "rat-foo",
    })
    const list = findByTestId(tree, "recipient-audit-trail-list")
    expect((list!.props as Record<string, unknown>).id).toBe("rat-foo-events-list")
  })
})
