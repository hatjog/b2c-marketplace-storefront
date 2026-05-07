/**
 * AuditTrailEmptyState — unit tests
 *
 * Coverage:
 *   - Empty variant: status role + emptyHeading + emptyBody copy
 *   - Populated variant: ol role-equivalent + first TimelineItem inside
 *   - Override copy props honoured
 */

import React from "react"
import { describe, expect, it } from "vitest"

import { AuditTrailEmptyState } from "../AuditTrailEmptyState/AuditTrailEmptyState"

type ReactEl = React.ReactElement<Record<string, unknown>>

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

function findByDataState(
  node: React.ReactNode,
  state: string,
): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null
  const el = node as ReactEl
  if (el.props["data-state"] === state) return el
  const children = React.Children.toArray(el.props.children as React.ReactNode)
  for (const child of children) {
    const found = findByDataState(child, state)
    if (found) return found
  }
  return null
}

describe("AuditTrailEmptyState", () => {
  it("renders the empty variant with default copy when no firstRow given", () => {
    const tree = AuditTrailEmptyState({}) as unknown as ReactEl
    expect(tree).not.toBeNull()
    const empty = findByDataState(tree, "empty")
    expect(empty).not.toBeNull()
    const text = collectText(tree).join(" ")
    expect(text).toContain("Brak wpisów w historii")
    expect(text).toMatch(/audit trail/i)
  })

  it("honours emptyHeading + emptyBody overrides", () => {
    const tree = AuditTrailEmptyState({
      emptyHeading: "Custom heading",
      emptyBody: "Custom body copy",
    }) as unknown as ReactEl
    const text = collectText(tree).join(" ")
    expect(text).toContain("Custom heading")
    expect(text).toContain("Custom body copy")
  })

  it("renders the populated variant with TimelineItem when firstRow provided", () => {
    const tree = AuditTrailEmptyState({
      firstRow: {
        timestamp: "2026-04-30T10:00:00Z",
        title: "Voucher utworzony",
        detail: "operator: jan@example.com",
        tone: "success",
      },
    }) as unknown as ReactEl
    const populated = findByDataState(tree, "populated")
    expect(populated).not.toBeNull()
    // The TimelineItem child is an element node — vitest runs in `node` env
    // (no renderer), so we inspect its props rather than rendered output.
    const children = React.Children.toArray(
      (populated as ReactEl).props.children as React.ReactNode,
    )
    expect(children.length).toBe(1)
    const timelineItem = children[0] as ReactEl
    const tiProps = timelineItem.props as Record<string, unknown>
    expect(tiProps.title).toBe("Voucher utworzony")
    expect(tiProps.detail).toBe("operator: jan@example.com")
    expect(tiProps.timestamp).toBe("2026-04-30T10:00:00Z")
    expect(tiProps.tone).toBe("success")
    expect(tiProps.isFirst).toBe(true)
    expect(tiProps.isLast).toBe(true)
  })

  it("populated variant has aria-label for the timeline list", () => {
    const tree = AuditTrailEmptyState({
      firstRow: { timestamp: "2026-01-01T00:00:00Z", title: "x" },
    }) as unknown as ReactEl
    expect((tree.props as Record<string, unknown>)["aria-label"]).toBe(
      "Historia audytu",
    )
  })
})
