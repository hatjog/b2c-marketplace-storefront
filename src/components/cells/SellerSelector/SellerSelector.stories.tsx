import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { NextIntlClientProvider } from 'next-intl';

import type { VendorOfferOption } from '@/types/product';

import { SellerSelector } from './SellerSelector';

/**
 * Story 5.2 — SellerSelector cell PDP multi-vendor picker.
 *
 * Variants per AC7:
 *  - SingleSeller       → 1 offer (component still renders; PDP-side
 *                         conditional gates on length > 1 — placed here
 *                         purely to demonstrate non-degenerate render)
 *  - ThreeSellersDefault → 3 offers; lowest-price pre-selected with badge
 *  - FiveSellers         → 5 offers; default = cheapest, distance metadata
 *  - WithDefaultOverride → 3 offers; defaultSelectedSellerId = non-cheapest
 *  - OnSelectActionLogged → emits onSelect callback into actions panel
 */

const messages = {
  seller: {
    selector: {
      title: 'Wybierz salon',
      choose_button: 'Wybierz',
      price_from: 'od',
      distance_km: '{distance} km',
      lowest_price_label: 'Najniższa cena',
    },
  },
};

const singleSeller: VendorOfferOption[] = [
  { seller_id: 'seller-1', seller_name: 'Salon Mokotów', price_pln: 149 },
];

const threeSellers: VendorOfferOption[] = [
  { seller_id: 'seller-1', seller_name: 'Salon Mokotów', price_pln: 149, distance_km: 2.5 },
  { seller_id: 'seller-2', seller_name: 'Salon Wola', price_pln: 129, distance_km: 4.1 },
  { seller_id: 'seller-3', seller_name: 'Salon Praga', price_pln: 169, distance_km: 6.8 },
];

const fiveSellers: VendorOfferOption[] = [
  { seller_id: 'seller-1', seller_name: 'Salon Mokotów', price_pln: 149, distance_km: 2.5 },
  { seller_id: 'seller-2', seller_name: 'Salon Wola', price_pln: 129, distance_km: 4.1 },
  { seller_id: 'seller-3', seller_name: 'Salon Praga', price_pln: 169, distance_km: 6.8 },
  { seller_id: 'seller-4', seller_name: 'Salon Bemowo', price_pln: 139, distance_km: 9.2 },
  { seller_id: 'seller-5', seller_name: 'Salon Centrum', price_pln: 159, distance_km: 1.4 },
];

const meta: Meta<typeof SellerSelector> = {
  title: 'Cells/SellerSelector',
  component: SellerSelector,
  tags: ['autodocs'],
  args: {
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="pl" messages={messages}>
        <div style={{ maxWidth: 480 }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SellerSelector>;

export const SingleSeller: Story = {
  name: 'Single seller',
  args: {
    sellers: singleSeller,
  },
  parameters: {
    docs: {
      description: {
        story:
          'One offer only. PDP gates on `vendor_offers.length > 1` so this state is rare in production; rendered here to verify safety of degenerate input.',
      },
    },
  },
};

export const ThreeSellersDefault: Story = {
  name: 'Three sellers (lowest pre-selected)',
  args: {
    sellers: threeSellers,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default selection = cheapest offer (Salon Wola, 129 zł). "Najniższa cena" badge marks the cheapest row regardless of current selection.',
      },
    },
  },
};

export const FiveSellers: Story = {
  name: 'Five sellers',
  args: {
    sellers: fiveSellers,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five offers including distance metadata. Verifies vertical radio list scales without dropdown collapse (UX-DR19 MVP threshold).',
      },
    },
  },
};

export const WithDefaultOverride: Story = {
  name: 'Default override (non-cheapest)',
  args: {
    sellers: threeSellers,
    defaultSelectedSellerId: 'seller-3',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Caller pins initial selection to a specific seller_id. Lowest-price badge still marks the cheapest row even though it is not selected.',
      },
    },
  },
};

export const OnSelectActionLogged: Story = {
  name: 'onSelect action (callback verify)',
  args: {
    sellers: threeSellers,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Click any row or its CTA to emit seller_id into the Storybook Actions panel.',
      },
    },
  },
};
