import type { Preview } from "@storybook/react"

// v1.5.0 design tokens (Story 6.1.a) — load token CSS vars + Tailwind base
// so component stories paint with the correct gold-accent / neutral palette.
import "../src/app/globals.css"

const preview: Preview = {
  initialGlobals: {
    locale: "en",
    locales: {
      en: "English",
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
