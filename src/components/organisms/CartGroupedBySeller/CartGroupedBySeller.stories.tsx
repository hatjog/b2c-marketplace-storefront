import type { Meta, StoryObj } from '@storybook/react';
import type { HttpTypes } from '@medusajs/types';
import { NextIntlClientProvider } from 'next-intl';

import { CartGroupedBySeller } from './CartGroupedBySeller';

/**
 * Story 5.7 — multi-vendor cart grouping organism.
 *
 * Two fixtures per AC6:
 *  - MixedSellers: 5 line items split across 2 named sellers + 1 default group;
 *    expected render order alphabetical (Salon Anna → Salon Marta) z default last.
 *  - SingleSeller: 3 line items all from `Salon Marta` → single section, no
 *    default group rendered (group helper omits empty buckets).
 *
 * Storybook decorator wraps z `NextIntlClientProvider` (locale `en`) i mock
 * messages dla `seller.cart.*` namespace; bezpośrednie standalone preview
 * bez API dependency.
 *
 * NOTE: organism is async Server Component (uses `getTranslations`).
 * Storybook 8 + `@storybook/nextjs` renders Server Components by awaiting
 * the JSX promise; mock messages provided here ensure the i18n provider
 * resolves the async call client-side without a live next-intl server config.
 */

const messages = {
  seller: {
    cart: {
      line_item_seller_label: 'Seller',
      from_seller: 'from {seller_name}',
      group_header_label: 'From seller: {seller_name}',
      default_seller_group_label: 'Other items',
      subtotal_per_seller: 'Subtotal: {amount}',
      visit_seller_storefront: 'Visit seller storefront',
    },
  },
};

const buildLineItem = (
  id: string,
  product_title: string,
  unit_price: number,
  quantity: number,
  seller?: { id: string; name: string; handle?: string }
): HttpTypes.StoreCartLineItem => {
  const subtotal = unit_price * quantity;
  return {
    id,
    cart_id: 'cart_fixture',
    title: product_title,
    quantity,
    unit_price,
    subtotal,
    total: subtotal,
    original_total: subtotal,
    original_subtotal: subtotal,
    discount_total: 0,
    discount_subtotal: 0,
    tax_total: 0,
    original_tax_total: 0,
    item_total: subtotal,
    item_subtotal: subtotal,
    item_tax_total: 0,
    raw_unit_price: { value: unit_price.toString(), precision: 20 } as never,
    product_handle: id,
    product_title,
    product_id: `prod_${id}`,
    variant_id: `var_${id}`,
    variant: { id: `var_${id}`, title: 'Default', options: [] } as never,
    thumbnail: null,
    metadata: seller
      ? {
          selected_seller_id: seller.id,
          selected_seller_name: seller.name,
          ...(seller.handle ? { selected_seller_handle: seller.handle } : {}),
        }
      : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as HttpTypes.StoreCartLineItem;
};

const buildCart = (items: HttpTypes.StoreCartLineItem[]): HttpTypes.StoreCart =>
  ({
    id: 'cart_fixture',
    currency_code: 'pln',
    region_id: 'reg_default',
    items,
    shipping_subtotal: 0,
    subtotal: items.reduce((acc, i) => acc + (i.subtotal ?? 0), 0),
    total: items.reduce((acc, i) => acc + (i.subtotal ?? 0), 0),
    item_subtotal: items.reduce((acc, i) => acc + (i.subtotal ?? 0), 0),
    tax_total: 0,
  }) as unknown as HttpTypes.StoreCart;

const meta: Meta<typeof CartGroupedBySeller> = {
  title: 'Organisms/CartGroupedBySeller',
  component: CartGroupedBySeller,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <div className="mx-auto max-w-3xl p-4">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CartGroupedBySeller>;

export const MixedSellers: Story = {
  name: 'Mixed sellers (3 groups, alphabetical, default last)',
  args: {
    cart: buildCart([
      buildLineItem('item_marta_1', 'Voucher Manicure', 18000, 1, {
        id: 'sel_marta',
        name: 'Salon Marta',
        handle: 'salon-marta',
      }),
      buildLineItem('item_marta_2', 'Voucher Pedicure', 12000, 2, {
        id: 'sel_marta',
        name: 'Salon Marta',
        handle: 'salon-marta',
      }),
      buildLineItem('item_anna_1', 'Voucher Massage', 22000, 1, {
        id: 'sel_anna',
        name: 'Salon Anna',
        handle: 'salon-anna',
      }),
      buildLineItem('item_anna_2', 'Voucher Facial', 15000, 1, {
        id: 'sel_anna',
        name: 'Salon Anna',
        handle: 'salon-anna',
      }),
      buildLineItem('item_legacy', 'Voucher Hair Cut', 9000, 1),
    ]),
    show_subtotal: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mixed cart: 5 line items split across 2 sellers + 1 legacy item without seller context. Expected sections: Salon Anna → Salon Marta (alphabetical) → Other items (default last).',
      },
    },
  },
};

export const SingleSeller: Story = {
  name: 'Single seller (1 group)',
  args: {
    cart: buildCart([
      buildLineItem('item_marta_1', 'Voucher Manicure', 18000, 1, {
        id: 'sel_marta',
        name: 'Salon Marta',
        handle: 'salon-marta',
      }),
      buildLineItem('item_marta_2', 'Voucher Pedicure', 12000, 2, {
        id: 'sel_marta',
        name: 'Salon Marta',
        handle: 'salon-marta',
      }),
      buildLineItem('item_marta_3', 'Voucher Massage', 22000, 1, {
        id: 'sel_marta',
        name: 'Salon Marta',
        handle: 'salon-marta',
      }),
    ]),
    show_subtotal: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Single-seller cart: all 3 items from Salon Marta. Render: 1 section, no default fallback group.',
      },
    },
  },
};
