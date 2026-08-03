import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import { LowestPriceBadge } from './LowestPriceBadge';

/**
 * Story 5.1 — LowestPriceBadge multi-vendor "od X zł" prefix.
 *
 * Variants per AC6:
 *  - SingleVendor    → vendorCount=1 → renders null per UX spec line 1104
 *  - MultiVendorTwo  → vendorCount=2 → "od" + tooltip "Cena od najtańszego z 2 salonów"
 *  - MultiVendorMany → vendorCount=12 → tooltip "Cena od najtańszego z 12 salonów"
 *
 * Storybook tooltip: native `title` attribute — hover desktop only (MVP).
 */

const messages = {
  seller: {
    lowest_price: {
      prefix: 'od',
      tooltip: 'Cena od najtańszego z {count} salonów',
    },
  },
};

const meta: Meta<typeof LowestPriceBadge> = {
  title: 'Atoms/LowestPriceBadge',
  component: LowestPriceBadge,
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

type Story = StoryObj<typeof LowestPriceBadge>;

export const SingleVendor: Story = {
  name: 'Single vendor (renders null)',
  args: { vendorCount: 1 },
  parameters: {
    docs: {
      description: {
        story: 'When vendorCount < 2 the badge renders nothing (per UX spec line 1104).',
      },
    },
  },
};

export const MultiVendorTwo: Story = {
  name: 'Multi-vendor (2 salons)',
  args: { vendorCount: 2 },
};

export const MultiVendorMany: Story = {
  name: 'Multi-vendor (12 salons)',
  args: { vendorCount: 12 },
};

export const InlineWithPrice: Story = {
  name: 'Inline with price (composition preview)',
  args: { vendorCount: 5 },
  render: (args) => (
    <div className="flex items-center gap-2">
      <LowestPriceBadge {...args} />
      <p className="text-lg font-medium">149 zł</p>
    </div>
  ),
};
