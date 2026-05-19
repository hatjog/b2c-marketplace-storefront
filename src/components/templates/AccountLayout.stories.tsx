import type { Meta, StoryObj } from '@storybook/react';

import { AccountLayout, type AccountSurface } from './AccountLayout';

const meta: Meta<typeof AccountLayout> = {
  component: AccountLayout,
  parameters: {
    docs: {
      description: {
        component:
          'Stub stories for AccountLayout T3 (Story 4.1). Surface pages W2-01..W2-13 are implemented in Stories 4.2/4.3 — this file only showcases the shared template structure.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AccountLayout>;

const t = (key: string) =>
  ({
    'a11y.skip_to_main': 'Skip to account content',
    'hero.aria_label': 'Account header',
    'hero.eyebrow': 'Account',
    'hero.greeting': 'Welcome!',
    'hero.greeting_with_name': 'Hi, {name}',
    'hero.subtitle': 'Manage your orders, vouchers and settings.',
    'quick_actions.aria_label': 'Quick actions',
    'content.aria_label': 'Account content',
    'sidebar.aria_label': 'Account sidebar',
    'nav.aria_label': 'Account navigation',
    'nav.items.dashboard': 'Overview',
    'nav.items.order_history': 'Orders',
    'nav.items.order_detail': 'Order details',
    'nav.items.active_vouchers': 'Active vouchers',
    'nav.items.used_vouchers': 'Used & expired vouchers',
    'nav.items.addresses': 'Addresses',
    'nav.items.payment_methods': 'Payment methods',
    'nav.items.notifications': 'Notifications',
    'nav.items.loyalty': 'Loyalty programme',
    'nav.items.referrals': 'Referrals',
    'nav.items.profile': 'Profile details',
    'nav.items.password': 'Password & security',
    'nav.items.delete_account': 'Delete account',
    'snapshot.heading': 'Account snapshot',
    'snapshot.loading_aria': 'Loading account snapshot',
    'snapshot.empty': 'Nothing to show yet.',
  })[key] ?? key;

const headerSlot = (
  <div className="bb-section-shell" style={{ margin: '16px' }}>
    <strong>Wave 6 SiteHeader (stub)</strong>
  </div>
);

const footerSlot = (
  <div className="bb-section-shell" style={{ margin: '16px' }}>
    <strong>Wave 6 SiteFooter (stub)</strong>
  </div>
);

const mainContent = (
  <div className="space-y-3">
    <h2 className="text-lg font-semibold">Surface content area (stub)</h2>
    <p className="text-sm text-[var(--text-secondary)]">
      This is where W2-01..W2-13 surface-specific content renders.
    </p>
  </div>
);

const quickActions = [
  { id: 'qa-1', label: 'Orders', href: '/account/orders', description: 'Track your purchases' },
  { id: 'qa-2', label: 'Vouchers', href: '/account/vouchers', description: 'View active vouchers' },
  { id: 'qa-3', label: 'Profile', href: '/account/profile', description: 'Update your details' },
];

const snapshotSections = [
  { id: 'ss-1', label: 'Orders', value: <span>2 active</span> },
  { id: 'ss-2', label: 'Vouchers', value: <span>1 available</span> },
  { id: 'ss-3', label: 'Loyalty', value: <span>Silver</span> },
];

function makeArgs(activeSurface: AccountSurface) {
  return {
    user: {
      id: 'cust_1',
      displayName: 'Alicia Example',
      email: 'alicia@example.com',
    },
    activeSurface,
    quickActions,
    snapshotSections,
    locale: 'en',
    t,
    breadcrumbs: [
      { label: 'Home', href: '/' },
      { label: 'Account', href: '/account' },
    ],
    headerSlot,
    mainContent,
    footerSlot,
  };
}

export const W2_01_Dashboard: Story = {
  args: makeArgs('W2-01'),
};

export const W2_04_ActiveVouchers: Story = {
  args: makeArgs('W2-04'),
};

export const LoadingState: Story = {
  args: {
    ...makeArgs('W2-02'),
    user: null,
    snapshotSections: [],
  },
};

