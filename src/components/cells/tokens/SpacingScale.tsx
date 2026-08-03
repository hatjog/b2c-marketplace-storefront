/**
 * SpacingScale — design token primitive (spacing demo)
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS sub-story 6.1.a
 *
 * Renders a horizontal bar per spacing token so designers + reviewers can
 * eyeball the 8px scale in context. CSS-var-driven; never hardcode px.
 */

import type { FC } from "react"

const SCALE: Array<{ token: string; cssVar: `--space-${string}` }> = [
  { token: "space-0.5", cssVar: "--space-0-5" },
  { token: "space-1", cssVar: "--space-1" },
  { token: "space-2", cssVar: "--space-2" },
  { token: "space-3", cssVar: "--space-3" },
  { token: "space-4", cssVar: "--space-4" },
  { token: "space-6", cssVar: "--space-6" },
  { token: "space-8", cssVar: "--space-8" },
  { token: "space-12", cssVar: "--space-12" },
  { token: "space-16", cssVar: "--space-16" },
  { token: "space-24", cssVar: "--space-24" },
]

export const SpacingScale: FC = () => {
  return (
    <ul
      aria-label="Skala spacingu"
      data-testid="spacing-scale-demo"
      className="flex flex-col gap-gp-2 text-gp-body-sm"
    >
      {SCALE.map(({ token, cssVar }) => (
        <li key={token} className="flex items-center gap-gp-3">
          <span className="w-32 font-gp-monospace text-gp-neutral-700">
            {token}
          </span>
          <span
            aria-hidden="true"
            className="h-gp-2 rounded-gp-xs bg-gp-accent-500"
            style={{ width: `var(${cssVar})` }}
          />
        </li>
      ))}
    </ul>
  )
}
