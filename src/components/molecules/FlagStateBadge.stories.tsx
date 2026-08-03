import type { Meta, StoryObj } from "@storybook/react"

import { FlagStateBadge } from "./FlagStateBadge"

/**
 * Story 6.1 / Sprint Week 0+ — FlagStateBadge ternary visual differentiation
 * (active / paused / disabled). Renders icon + copy + distinct background tone.
 *
 * Visual snapshot baseline DEFERRED to v1.5.1 per Risk #4 capacity.
 */
const meta: Meta<typeof FlagStateBadge> = {
  title: "Molecules/FlagStateBadge",
  component: FlagStateBadge,
  tags: ["autodocs"],
  argTypes: {
    state: {
      control: { type: "radio" },
      options: ["active", "paused", "disabled"],
    },
    label: { control: "text" },
  },
}

export default meta

type Story = StoryObj<typeof FlagStateBadge>

export const Active: Story = {
  args: { state: "active" },
}

export const Paused: Story = {
  args: { state: "paused" },
}

export const Disabled: Story = {
  args: { state: "disabled" },
}

export const AllThree: Story = {
  render: () => (
    <div className="flex flex-col gap-gp-3">
      <FlagStateBadge state="active" />
      <FlagStateBadge state="paused" />
      <FlagStateBadge state="disabled" />
    </div>
  ),
}
