'use client';

import { useState } from 'react';

import { useUnreads } from '@talkjs/react';
import { useTranslations } from 'next-intl';

import { Badge, Divider, LogoutButton, NavigationItem } from '@/components/atoms';
import { Dropdown } from '@/components/molecules';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { ProfileIcon } from '@/icons';

export const UserDropdown = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const [open, setOpen] = useState(false);
  const t = useTranslations('navigation');

  const unreads = useUnreads();

  return (
    <div
      className="relative"
      onMouseOver={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
    >
      <LocalizedClientLink
        href={isLoggedIn ? '/user' : '/login'}
        className="relative"
        aria-label={t('account_aria')}
      >
        <ProfileIcon size={20} />
      </LocalizedClientLink>
      <Dropdown show={open}>
        {isLoggedIn ? (
          <div className="p-1">
            <div className="lg:w-[200px]">
              <h3 className="heading-xs border-b p-4 uppercase">{t('your_account')}</h3>
            </div>
            <NavigationItem href="/user/orders">{t('orders')}</NavigationItem>
            <NavigationItem
              href="/user/messages"
              className="relative"
            >
              {t('messages')}
              {Boolean(unreads?.length) && (
                <Badge className="absolute left-24 top-3 h-4 w-4 p-0">{unreads?.length}</Badge>
              )}
            </NavigationItem>
            <NavigationItem href="/user/returns">{t('returns')}</NavigationItem>
            <NavigationItem href="/user/addresses">{t('addresses')}</NavigationItem>
            <NavigationItem href="/user/reviews">{t('reviews')}</NavigationItem>
            <NavigationItem href="/user/wishlist">{t('wishlist')}</NavigationItem>
            <Divider />
            <NavigationItem href="/user/settings">{t('settings')}</NavigationItem>
            <LogoutButton />
          </div>
        ) : (
          <div className="p-1">
            <NavigationItem href="/login">{t('login')}</NavigationItem>
            <NavigationItem href="/register">{t('register')}</NavigationItem>
          </div>
        )}
      </Dropdown>
    </div>
  );
};
