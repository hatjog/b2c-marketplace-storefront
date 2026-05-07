/**
 * FlagStateBadge — unit tests
 *
 * Coverage:
 *   - Each ternary state renders a distinct icon glyph (NOT same shape +
 *     color shift) — guards AC-FLAG-STATE-TERNARY-VISUAL-01
 *   - Tap-target min sizing classes present — guards AC-UI-6.1-09
 *   - aria-label localized per state
 *   - data-state attribute matches state prop (analytics + e2e hook)
 *
 * Strategy: vitest runs in `node` env (no DOM). We inspect the React element
 * tree directly, mirroring the VendorBadge.test.tsx pattern in this repo.
 */

import React from "react"
import { describe, expect, it } from "vitest"

import { FlagStateBadge, type FlagState } from "../FlagStateBadge"

type SyncReactEl = React.ReactElement<Record<string, unknown>>

function collectText(node: React.ReactNode, acc: string[] = []): string[] {
  if (typeof node === "string") {
    acc.push(node)
    return acc
  }
  if (typeof node === "number") {
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

describe("FlagStateBadge", () => {
  const STATES: FlagState[] = ["active", "paused", "disabled"]

  it("renders distinct icon glyphs per state (NOT color-only differentiation)", () => {
    const glyphs = STATES.map((state) => {
      const tree = FlagStateBadge({ state }) as unknown as SyncReactEl
      const text = collectText(tree).join("")
      // First char is the icon glyph in our copy template
      return text.replace(/\s+/g, "").charAt(0)
    })

    // All three glyphs must be unique — guards AC-FLAG-STATE-TERNARY-VISUAL-01
    const unique = new Set(glyphs)
    expect(unique.size).toBe(STATES.length)
  })

  it("emits localized aria-label per state", () => {
    const cases: Array<[FlagState, string]> = [
      ["active", "Stan flagi: Aktywny"],
      ["paused", "Stan flagi: Wstrzymany"],
      ["disabled", "Stan flagi: Wyłączony"],
    ]
    for (const [state, expected] of cases) {
      const tree = FlagStateBadge({ state }) as unknown as SyncReactEl
      expect((tree.props as Record<string, unknown>)["aria-label"]).toBe(expected)
    }
  })

  it("sets data-state attribute matching the state prop", () => {
    for (const state of STATES) {
      const tree = FlagStateBadge({ state }) as unknown as SyncReactEl
      expect((tree.props as Record<string, unknown>)["data-state"]).toBe(state)
    }
  })

  it("includes tap-target minimum sizing classes (AC-UI-6.1-09 ≥48×48px)", () => {
    const tree = FlagStateBadge({ state: "active" }) as unknown as SyncReactEl
    const className = (tree.props as Record<string, unknown>).className as string
    expect(className).toMatch(/min-h-gp-tap-target-min/)
    expect(className).toMatch(/min-w-gp-tap-target-min/)
  })

  it("supports a custom label override", () => {
    const tree = FlagStateBadge({ state: "active", label: "Custom" }) as unknown as SyncReactEl
    const text = collectText(tree).join("")
    expect(text).toContain("Custom")
  })
})
