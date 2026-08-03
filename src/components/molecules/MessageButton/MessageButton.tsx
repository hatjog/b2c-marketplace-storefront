'use client';

import { useUnreads } from '@talkjs/react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/atoms';
import { MessageIcon } from '@/icons';

import LocalizedClientLink from '../LocalizedLink/LocalizedLink';

export const MessageButton = () => {
  const unreads = useUnreads();
  const t = useTranslations('navigation');

  return (
    <LocalizedClientLink
      href="/user/messages"
      className="relative"
      aria-label={t('messages')}
    >
      <MessageIcon
        size={20}
        aria-hidden="true"
      />
      {Boolean(unreads?.length) && (
        <Badge className="absolute -right-2 -top-2 h-4 w-4 p-0">{unreads?.length}</Badge>
      )}
    </LocalizedClientLink>
  );
};
