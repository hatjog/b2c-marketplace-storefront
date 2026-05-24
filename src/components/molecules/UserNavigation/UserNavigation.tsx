'use client';

import { useUnreads } from '@talkjs/react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { Badge, Card, Divider, LogoutButton, NavigationItem } from '@/components/atoms';

const navigationItems = [
  { key: 'orders', href: '/user/orders' },
  { key: 'vouchers', href: '/user/vouchers' },
  { key: 'messages', href: '/user/messages' },
  { key: 'returns', href: '/user/returns' },
  { key: 'addresses', href: '/user/addresses' },
  { key: 'reviews', href: '/user/reviews' },
  { key: 'wishlist', href: '/user/wishlist' }
];

export const UserNavigation = () => {
  const t = useTranslations('navigation');
  const unreads = useUnreads();
  const path = usePathname();

  return (
    <Card className="bb-section-shell h-min !p-2">
      {navigationItems.map(item => (
        <NavigationItem
          key={item.key}
          href={item.href}
          active={path === item.href}
          className="relative rounded-full"
        >
          {t(item.key)}
          {item.key === 'messages' && Boolean(unreads?.length) && (
            <Badge className="absolute left-24 top-3 h-4 w-4 p-0">{unreads?.length}</Badge>
          )}
        </NavigationItem>
      ))}
      <Divider className="my-2 border-[var(--bb-border-soft)]" />
      <NavigationItem
        href={'/user/settings'}
        active={path === '/user/settings'}
        className="rounded-full"
      >
        {t('settings')}
      </NavigationItem>
      <LogoutButton className="w-full text-left" />
    </Card>
  );
};
