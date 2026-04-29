/**
 * ColorSwatch — design token primitive (color)
 *
 * Source spec: STORY-6-1-CUSTOM-UI-COMPONENTS sub-story 6.1.a (Token system stub)
 *
 * Display-only primitive used by Storybook stories + design-token QA pages
 * to render a labeled color sample driven by CSS variables.
 *
 * NEVER hardcode hex values here — always reference `--color-*` tokens so
 * `validate_design_tokens.py` keeps the swatches in lock-step with the
 * single source of truth.
 */

import type { FC } from "react"

export interface ColorSwatchProps {
  /** CSS variable name without `var()`, e.g. `--color-accent-500` */
  cssVar: `--color-${string}`
  /** Display label (e.g. "accent-500") */
  label: string
  /** Optional secondary caption (intended use) */
  caption?: string
  "data-testid"?: string
}

export const ColorSwatch: FC<ColorSwatchProps> = ({
  cssVar,
  label,
  caption,
  "data-testid": dataTestId,
}) => {
  return (
    <figure
      data-testid={dataTestId ?? `color-swatch-${label}`}
      className="flex flex-col gap-gp-2"
    >
      <div
        aria-hidden="true"
        className="h-gp-12 w-full rounded-gp-md border border-gp-neutral-200"
        style={{ backgroundColor: `hsl(var(${cssVar}))` }}
      />
      <figcaption className="flex flex-col gap-gp-0.5">
        <span className="font-gp-monospace text-gp-body-sm text-gp-neutral-700">
          {label}
        </span>
        {caption ? (
          <span className="text-gp-body-sm text-gp-neutral-500">
            {caption}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}
