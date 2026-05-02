import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { NextIntlClientProvider } from 'next-intl';

import { PurchaseModeToggle } from './PurchaseModeToggle';

/**
 * Story 5.8 — PurchaseModeToggle molecule fixtures.
 *
 * Variants per AC7:
 *   - DefaultSelf      → mode='self' checked; default flow per FR67 self-as-default
 *   - GiftSelected     → mode='gift' checked; gift placeholder lives in parent
 *                        cart/checkout page (Epic 6 territory)
 *   - OnChangeActionLogged → emits onChange callback into Storybook actions panel
 */

const messages = {
  seller: {
    checkout: {
      purchase_mode_label: 'Dla kogo kupujesz?',
      mode_self: 'Dla siebie',
      mode_gift: 'W prezencie',
      mode_self_description:
        'Domyślny zakup dla Ciebie — szybkie checkout bez dodatkowych kroków',
      mode_gift_description:
        'Wyślij prezent — dodaj dane odbiorcy w kolejnym kroku',
      recipient_placeholder:
        'Dane odbiorcy zostaną dodane w kolejnej wersji (Story 6.x — Recipient Claim)'
    }
  }
};

const meta: Meta<typeof PurchaseModeToggle> = {
  title: 'Molecules/PurchaseModeToggle',
  component: PurchaseModeToggle,
  tags: ['autodocs'],
  args: {
    onChange: fn()
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="pl" messages={messages}>
        <div style={{ maxWidth: 640 }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof PurchaseModeToggle>;

export const DefaultSelf: Story = {
  name: 'Default (self pre-selected)',
  args: {
    mode: 'self'
  },
  parameters: {
    docs: {
      description: {
        story:
          'FR67 default state: "Dla siebie" radio is checked. Marta-self persona (~80% buyer rate) sees frictionless checkout — no recipient form, no gift fields. Toggle is the explicit decision point pre-payment.'
      }
    }
  }
};

export const GiftSelected: Story = {
  name: 'Gift selected (opt-in)',
  args: {
    mode: 'gift'
  },
  parameters: {
    docs: {
      description: {
        story:
          'FR68 opt-in state: "W prezencie" radio is checked. Marta-gift persona (~20% buyer rate) explicitly toggled gift mode. The recipient details placeholder card lives in the PARENT cart/checkout page — it is NOT rendered inside this molecule (single-source-of-truth: parent owns mode state for URL sync).'
      }
    }
  }
};

export const OnChangeActionLogged: Story = {
  name: 'onChange action (callback verify)',
  args: {
    mode: 'self'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Click either radio card to emit the new mode value into the Storybook Actions panel. Verifies the controlled-component contract (parent owns state; molecule is pure presentational composition).'
      }
    }
  }
};
