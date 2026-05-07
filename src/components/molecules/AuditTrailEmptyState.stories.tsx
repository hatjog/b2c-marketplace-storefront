import type { Meta, StoryObj } from "@storybook/react"

import { AuditTrailEmptyState } from "./AuditTrailEmptyState/AuditTrailEmptyState"

/**
 * Story 6.1 / Sprint Week 0+ — AuditTrailEmptyState empty + first-row variants.
 * Full RecipientAuditTrailTimeline shipped in Story v160-cleanup-53 (TF-130).
 * See Molecules/RecipientAuditTrailTimeline stories for the full component.
 */
const meta: Meta<typeof AuditTrailEmptyState> = {
  title: "Molecules/AuditTrailEmptyState",
  component: AuditTrailEmptyState,
  tags: ["autodocs"],
}

export default meta

type Story = StoryObj<typeof AuditTrailEmptyState>

export const Empty: Story = {
  args: {},
}

export const EmptyWithCustomCopy: Story = {
  args: {
    emptyHeading: "Brak aktywności",
    emptyBody:
      "Czekamy na pierwsze zdarzenie. Audit trail aktualizuje się natychmiast po akcji operatora.",
  },
}

export const PopulatedFirstRow: Story = {
  args: {
    firstRow: {
      timestamp: "2026-04-30T10:15:00Z",
      title: "Voucher utworzony",
      detail: "Operator: jan@example.com  ·  Wartość: 250.00 PLN",
      tone: "success",
    },
  },
}
