import type { Meta, StoryObj } from "@storybook/react"

import { VoucherAuditTrail } from "./VoucherAuditTrail/VoucherAuditTrail"
import type { VoucherAuditEvent } from "@/types/voucher"

/**
 * Story v160-6-3 — VoucherAuditTrail molecule fixtures.
 *
 * The component is an async Server Component that calls
 * `next-intl/server.getTranslations()`. Storybook's plain CSF render path
 * does not provide a NextIntl server context, so these stories are authored
 * as documentation-reference fixtures per AC7 fallback clause: payload
 * shape + event ordering + AR45 boundary contract are visible to reviewers
 * even when the runtime renders the component in a Server Component
 * boundary only.
 *
 * AR45 invariant: every event in every fixture carries ONLY
 * `{ id, event_type, occurred_at, metadata: {} }` — no buyer-side fields.
 */

const meta: Meta<typeof VoucherAuditTrail> = {
  title: "Molecules/VoucherAuditTrail",
  component: VoucherAuditTrail,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Recipient-visible voucher lifecycle timeline (created → sent → opened → claimed [+ withdrawn]). Server Component; collapsible via native HTML <details>. Privacy boundary AR45: zero buyer-side metadata in DOM.",
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof VoucherAuditTrail>

const baseDate = "2026-05-01T10:00:00Z"

const allEvents: VoucherAuditEvent[] = [
  { id: "evt_1", event_type: "created", occurred_at: baseDate, metadata: {} },
  {
    id: "evt_2",
    event_type: "sent",
    occurred_at: "2026-05-01T10:05:00Z",
    metadata: {},
  },
  {
    id: "evt_3",
    event_type: "opened",
    occurred_at: "2026-05-02T08:30:00Z",
    metadata: {},
  },
  {
    id: "evt_4",
    event_type: "claimed",
    occurred_at: "2026-05-03T14:15:00Z",
    metadata: {},
  },
]

export const AllEvents: Story = {
  args: {
    events: allEvents,
    locale: "pl",
  },
}

export const PartialClaimed: Story = {
  args: {
    events: allEvents.slice(0, 3),
    locale: "pl",
  },
}

export const WithdrawnState: Story = {
  args: {
    events: [
      ...allEvents.slice(0, 3),
      {
        id: "evt_5",
        event_type: "withdrawn",
        occurred_at: "2026-05-03T14:15:00Z",
        metadata: {},
      },
    ],
    locale: "pl",
  },
}

export const Empty: Story = {
  args: {
    events: [],
    locale: "en",
  },
}
