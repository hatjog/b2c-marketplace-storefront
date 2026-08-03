import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import { SellerStatusBadge } from './SellerStatusBadge';

/**
 * Story 3.6 — SellerStatusBadge Vendor lifecycle status pill (4 variants).
 *
 * Variants per AC4 (one story per Mercur 2.1.1 lifecycle enum value):
 *  - PendingApproval → yellow badge, "Pending approval"
 *  - Open            → green badge,  "Open"
 *  - Suspended       → orange badge, "Suspended"
 *  - Terminated      → gray badge,   "Terminated"
 *
 * Color coding follows UX-DR79 semantic mapping:
 *   success(open) / caution(pending) / warning(suspended) / inactive(terminated).
 *
 * Storybook locale: `en` default — PL copy mocked separately if needed for
 * locale-toggle review.
 */

const messages = {
  seller: {
    status: {
      pending_approval: 'Pending approval',
      open: 'Open',
      suspended: 'Suspended',
      terminated: 'Terminated',
    },
  },
};

const meta: Meta<typeof SellerStatusBadge> = {
  title: 'Atoms/SellerStatusBadge',
  component: SellerStatusBadge,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: { type: 'select' },
      options: ['pending_approval', 'open', 'suspended', 'terminated'],
    },
    className: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SellerStatusBadge>;

export const PendingApproval: Story = {
  name: 'Pending approval (yellow)',
  args: { status: 'pending_approval' },
  parameters: {
    docs: {
      description: {
        story: 'Vendor registered but admin has not yet approved. Storefront does not render seller — badge surfaces in admin context only.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Open (green)',
  args: { status: 'open' },
  parameters: {
    docs: {
      description: {
        story: 'Active vendor — visible to storefront via Mercur 2 middleware visibility filter.',
      },
    },
  },
};

export const Suspended: Story = {
  name: 'Suspended (orange)',
  args: { status: 'suspended' },
  parameters: {
    docs: {
      description: {
        story: 'Temporarily admin-suspended vendor. Storefront returns 404; badge for admin context.',
      },
    },
  },
};

export const Terminated: Story = {
  name: 'Terminated (gray)',
  args: { status: 'terminated' },
  parameters: {
    docs: {
      description: {
        story: 'Final state — vendor permanently disabled. Inactive badge color (gray).',
      },
    },
  },
};
