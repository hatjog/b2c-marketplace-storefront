import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundColor: {
        primary: "rgba(var(--bg-primary))",
        secondary: "rgba(var(--bg-secondary))",
        tertiary: "rgba(var(--bg-tertiary))",
        disabled: "rgba(var(--bg-disabled))",
        component: {
          DEFAULT: "rgba(var(--bg-component-primary))",
          hover: "rgba(var(--bg-component-primary-hover))",
          secondary: {
            DEFAULT: "rgba(var(--bg-component-secondary))",
            hover: "rgba(var(--bg-component-secondary-hover))",
          },
        },
        action: {
          DEFAULT: "rgba(var(--bg-action-primary))",
          hover: "rgba(var(--bg-action-primary-hover))",
          pressed: "rgba(var(--bg-action-primary-pressed))",
          secondary: {
            DEFAULT: "var(--bg-action-secondary)",
            hover: "var(--bg-action-secondary-hover)",
            pressed: "var(--bg-action-secondary-pressed)",
          },
          tertiary: {
            DEFAULT: "var(--bg-action-tertiary)",
            hover: "var(--bg-action-tertiary-hover)",
            pressed: "var(--bg-action-tertiary-pressed)",
          },
        },
        positive: {
          DEFAULT: "rgba(var(--bg-positive-primary))",
          hover: "rgba(var(--bg-positive-primary-hover))",
          pressed: "rgba(var(--bg-positive-primary-pressed))",
          secondary: {
            DEFAULT: "rgba(var(--bg-positive-secondary))",
            hover: "rgba(var(--bg-positive-secondary-hover))",
            pressed: "rgba(var(--bg-positive-secondary-pressed))",
          },
        },
        negative: {
          DEFAULT: "rgba(var(--bg-negative-primary))",
          hover: "rgba(var(--bg-negative-primary-hover))",
          pressed: "rgba(var(--bg-negative-primary-pressed))",
          secondary: {
            DEFAULT: "rgba(var(--bg-negative-secondary))",
            hover: "rgba(var(--bg-negative-secondary-hover))",
            pressed: "rgba(var(--bg-negative-secondary-pressed))",
          },
        },
        warning: {
          DEFAULT: "rgba(var(--bg-warning-primary))",
          hover: "rgba(var(--bg-warning-primary-hover))",
          pressed: "rgba(var(--bg-warning-primary-pressed))",
          secondary: {
            DEFAULT: "rgba(var(--bg-warning-secondary))",
            hover: "rgba(var(--bg-warning-secondary-hover))",
            pressed: "rgba(var(--bg-warning-secondary-pressed))",
          },
        },
      },
      colors: {
        primary: "rgba(var(--content-primary))",
        secondary: "rgba(var(--content-secondary))",
        tertiary: "rgba(var(--content-tertiary))",
        disabled: "rgba(var(--content-disabled))",
        action: {
          DEFAULT: "rgba(var(--content-action-primary))",
          hover: "rgba(var(--content-action-primary-hover))",
          pressed: "rgba(var(--content-action-primary-pressed))",
          on: {
            primary: "rgba(var(--content-action-on-primary))",
            secondary: "rgba(var(--content-action-on-secondary))",
            tertiary: "rgba(var(--content-action-on-tertiary))",
          },
        },
        positive: {
          DEFAULT: "rgba(var(--content-positive-primary))",
          on: {
            primary: "rgba(var(--content-positive-on-primary))",
            secondary: "rgba(var(--content-positive-on-secondary))",
          },
        },
        negative: {
          DEFAULT: "rgba(var(--content-negative-primary))",
          on: {
            primary: "rgba(var(--content-negative-on-primary))",
            secondary: "rgba(var(--content-negative-on-secondary))",
          },
        },
        warning: {
          DEFAULT: "rgba(var(--content-warning-primary))",
          on: {
            primary: "rgba(var(--content-warning-on-primary))",
            secondary: "rgba(var(--content-warning-on-secondary))",
          },
        },
        // BonBeauty semantic color tokens (full rgb() values — opacity modifiers not supported)
        cta: {
          DEFAULT: 'var(--cta)',
          hover: 'var(--cta-hover)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          light: 'var(--gold-light)',
        },
        trust: 'var(--color-trust)',
        error: 'var(--color-error)',
      },
      borderColor: {
        DEFAULT: "rgba(var(--border-primary))",
        primary: "rgba(var(--border-primary))",
        secondary: "rgba(var(--border-secondary))",
        action: "rgba(var(--border-action))",
        negative: {
          DEFAULT: "rgba(var(--border-negative-primary))",
          secondary: "rgba(var(--border-negative-secondary))",
        },
        positive: {
          DEFAULT: "rgba(var(--border-positive-primary))",
          secondary: "rgba(var(--border-positive-secondary))",
        },
        warning: {
          DEFAULT: "rgba(var(--border-warning-primary))",
          secondary: "rgba(var(--border-warning-secondary))",
        },
        disabled: "rgba(var(--border-disabled))",
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        full: "1000px",
        // v1.5.0 design tokens (Story 6.1.a) — gp- prefixed, wired via CSS vars
        "gp-none": "var(--radius-none)",
        "gp-xs":   "var(--radius-xs)",
        "gp-sm":   "var(--radius-sm)",
        "gp-md":   "var(--radius-md)",
        "gp-lg":   "var(--radius-lg)",
        "gp-xl":   "var(--radius-xl)",
        "gp-full": "var(--radius-full)",
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      fill: {
        primary: "rgba(var(--content-action-on-primary))",
        secondary: "rgba(var(--content-action-on-secondary))",
        disabled: "rgba(var(--content-disabled))",
      },
      // v1.5.0 design tokens (Story 6.1.a) — wired via CSS vars from
      // src/styles/tokens/. Validator: _grow/tools/validate_design_tokens.py
      colors: {
        "gp-flag-active-bg": "hsl(var(--color-flag-active-bg))",
        "gp-flag-active-fg": "hsl(var(--color-flag-active-fg))",
        "gp-flag-paused-bg": "hsl(var(--color-flag-paused-bg))",
        "gp-flag-paused-fg": "hsl(var(--color-flag-paused-fg))",
        "gp-flag-disabled-bg": "hsl(var(--color-flag-disabled-bg))",
        "gp-flag-disabled-fg": "hsl(var(--color-flag-disabled-fg))",
        "gp-accent": {
          50:  "hsl(var(--color-accent-50))",
          100: "hsl(var(--color-accent-100))",
          300: "hsl(var(--color-accent-300))",
          500: "hsl(var(--color-accent-500))",
          700: "hsl(var(--color-accent-700))",
          900: "hsl(var(--color-accent-900))",
        },
        "gp-neutral": {
          0:    "hsl(var(--color-neutral-0))",
          50:   "hsl(var(--color-neutral-50))",
          100:  "hsl(var(--color-neutral-100))",
          200:  "hsl(var(--color-neutral-200))",
          300:  "hsl(var(--color-neutral-300))",
          400:  "hsl(var(--color-neutral-400))",
          500:  "hsl(var(--color-neutral-500))",
          600:  "hsl(var(--color-neutral-600))",
          700:  "hsl(var(--color-neutral-700))",
          800:  "hsl(var(--color-neutral-800))",
          900:  "hsl(var(--color-neutral-900))",
          1000: "hsl(var(--color-neutral-1000))",
        },
      },
      spacing: {
        "gp-0":    "var(--space-0)",
        "gp-0.5":  "var(--space-0-5)",
        "gp-1":    "var(--space-1)",
        "gp-2":    "var(--space-2)",
        "gp-3":    "var(--space-3)",
        "gp-4":    "var(--space-4)",
        "gp-6":    "var(--space-6)",
        "gp-8":    "var(--space-8)",
        "gp-12":   "var(--space-12)",
        "gp-16":   "var(--space-16)",
        "gp-24":   "var(--space-24)",
        "gp-tap-target-min": "var(--tap-target-min)",
      },
      fontFamily: {
        "gp-serif":     "var(--font-family-serif)",
        "gp-sans":      "var(--font-family-sans)",
        "gp-monospace": "var(--font-family-monospace)",
      },
      fontSize: {
        "gp-display-1": "var(--font-size-display-1)",
        "gp-display-2": "var(--font-size-display-2)",
        "gp-h1":        "var(--font-size-h1)",
        "gp-h2":        "var(--font-size-h2)",
        "gp-h3":        "var(--font-size-h3)",
        "gp-h4":        "var(--font-size-h4)",
        "gp-body":      "var(--font-size-body)",
        "gp-body-sm":   "var(--font-size-body-sm)",
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    })
  ],
} satisfies Config
