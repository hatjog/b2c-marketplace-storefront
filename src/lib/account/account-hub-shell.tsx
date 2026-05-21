import type { AccountSurface, QuickAction, SnapshotSection } from '@/components/templates/AccountLayout';

interface AccountHubShellInput {
  locale: string;
  activeSurface: AccountSurface;
  orderCount?: number;
  addressCount?: number;
  reviewCount?: number;
}

export function buildWriteHeavyQuickActions(locale: string): QuickAction[] {
  return [
    {
      id: 'returns',
      label: 'account.layout.nav.items.used_vouchers',
      href: `/${locale}/user/orders`,
      description: 'account_write.quick_actions.returns',
    },
    {
      id: 'addresses',
      label: 'account.layout.nav.items.addresses',
      href: `/${locale}/user/addresses`,
      description: 'account_write.quick_actions.addresses',
    },
    {
      id: 'reviews',
      label: 'account.layout.nav.items.profile',
      href: `/${locale}/user/reviews/written`,
      description: 'account_write.quick_actions.reviews',
    },
  ];
}

export function buildWriteHeavySnapshot({
  orderCount = 0,
  addressCount = 0,
  reviewCount = 0,
}: Omit<AccountHubShellInput, 'locale' | 'activeSurface'>): SnapshotSection[] {
  return [
    {
      id: 'orders',
      label: 'account_write.snapshot.orders',
      value: `${orderCount}`,
    },
    {
      id: 'addresses',
      label: 'account_write.snapshot.addresses',
      value: `${addressCount}`,
    },
    {
      id: 'reviews',
      label: 'account_write.snapshot.reviews',
      value: `${reviewCount}`,
    },
  ];
}
