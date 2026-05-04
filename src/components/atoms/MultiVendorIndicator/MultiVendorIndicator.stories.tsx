import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import { MultiVendorIndicator } from './MultiVendorIndicator';

/**
 * Story cleanup-12b — MultiVendorIndicator PLP atom.
 *
 * Variants per AC6:
 *  - SingleVendor    → vendorCount=1 → renders null (atom hidden)
 *  - MultiVendorTwo  → vendorCount=2 → "2 salonów oferuje"
 *  - MultiVendorFive → vendorCount=5 → "5 salonów oferuje"
 *
 * E2E gate: `[data-testid="multi-vendor-indicator"]` must be visible for
 * Story 8.8 AC6 Step 1 to pass when flag ON + multi-vendor seed active.
 */

const messages = {
  seller: {
    multi_vendor: {
      indicator_label: '{count} salonów oferuje',
      indicator_tooltip: 'Ten produkt oferowany przez {count} salonów partnerskich',
    },
  },
};

const meta: Meta<typeof MultiVendorIndicator> = {
  title: 'Atoms/MultiVendorIndicator',
  component: MultiVendorIndicator,
  tags: ['autodocs'],
  argTypes: {
    vendorCount: {
      control: { type: 'number', min: 0, max: 50 },
    },
    className: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="pl" messages={messages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof MultiVendorIndicator>;

export const SingleVendor: Story = {
  name: 'Single vendor (renders null)',
  args: { vendorCount: 1 },
  parameters: {
    docs: {
      description: {
        story: 'When vendorCount < 2 the indicator renders nothing.',
      },
    },
  },
};

export const MultiVendorTwo: Story = {
  name: 'Multi-vendor (2 salons)',
  args: { vendorCount: 2 },
};

export const MultiVendorFive: Story = {
  name: 'Multi-vendor (5 salons)',
  args: { vendorCount: 5 },
};

export const InlineWithBadge: Story = {
  name: 'Inline with LowestPriceBadge (composition preview)',
  args: { vendorCount: 3 },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-secondary">od</span>
      <MultiVendorIndicator {...args} />
      <p className="text-lg font-medium">149 zł</p>
    </div>
  ),
};
