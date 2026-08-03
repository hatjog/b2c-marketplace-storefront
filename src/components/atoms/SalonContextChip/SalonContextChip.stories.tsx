import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import { SalonContextChip } from './SalonContextChip';

/**
 * Story 4.6 — SalonContextChip PDP context preservation overlay.
 *
 * Two stories per AC1:
 *   - WithContext    — seller passed; full chip renders (label + back + close).
 *   - WithoutContext — seller=null; component returns null (canvas empty).
 *
 * Storybook locale: `pl` default — chip text Polish per Persona Dorota MVP.
 *
 * Mock note: `useRouter` / `usePathname` come from `next/navigation`. Storybook
 * Next.js framework configures `parameters.nextjs.appDirectory: true` and
 * provides default mocks for these hooks. Close X handler is a no-op in
 * Storybook canvas (mock router); back link is a real `<Link>` that simulates
 * navigation.
 */

const messages = {
  seller: {
    detail: {
      context_chip_label: 'Z salonu: {name}',
      context_chip_back: 'Wróć do salonu',
      context_chip_close: 'Zamknij',
    },
  },
};

const meta: Meta<typeof SalonContextChip> = {
  title: 'Atoms/SalonContextChip',
  component: SalonContextChip,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    docs: {
      description: {
        component:
          'Sticky overlay chip preserving salon context on PDP when buyer drills from seller detail (`?from=seller:{handle}`). Anti-disorientation safeguard for multi-vendor PDP — keeps salon context anchored across compare-products flow.',
      },
    },
  },
  argTypes: {
    seller: { control: 'object' },
    locale: { control: 'text' },
    className: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="pl" messages={messages}>
        <div style={{ position: 'relative', minHeight: '120px', padding: '16px' }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SalonContextChip>;

export const WithContext: Story = {
  name: 'With salon context',
  args: {
    seller: { name: 'Salon Test', handle: 'salon-test' },
    locale: 'pl',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Chip renders fixed top-right with i18n label "Z salonu: {name}", back-link icon to seller detail, and close X. Click close → router.replace(pathname) drops `?from=seller:` query param.',
      },
    },
  },
};

export const WithoutContext: Story = {
  name: 'Without salon context (returns null)',
  args: {
    seller: null,
    locale: 'pl',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `seller` prop is null (no `?from=seller:` match in URL), component returns null — Storybook canvas renders empty. Defensive no-op render.',
      },
    },
  },
};
