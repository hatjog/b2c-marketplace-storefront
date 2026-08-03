'use client';

import { format, isValid } from 'date-fns';
import { useTranslations } from 'next-intl';

import { Divider } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import type { SingleProductSeller } from '@/types/product';

import { SellerAvatar } from '../SellerAvatar/SellerAvatar';

// Client component on purpose: both parents are server components that do not
// carry `locale`, so the `getTranslations` shorthand here would silently resolve
// against DEFAULT_LOCALE. The client provider dictionary is keyed by route
// locale (QD-03 `getMessages({ locale })`), so this is the correct boundary.
export const CartItemsHeader = ({ seller }: { seller: SingleProductSeller }) => {
  const t = useTranslations('seller');
  const joinedDate = formatSellerJoinDate(seller.created_at);

  const content = (
    <div className="flex items-center gap-4 rounded-[var(--bb-radius-card)] border p-4">
      <SellerAvatar
        photo={seller.photo || seller.logo || undefined}
        size={32}
        alt={seller.name}
      />

      <div className="gap-2 lg:flex">
        <p className="heading-xs uppercase">{seller.name}</p>
        {seller.id !== 'fleek' && joinedDate && (
          <div className="flex items-center gap-2">
            <Divider square />
            <p className="label-md text-secondary">
              {t('cart.joined_since', { date: joinedDate })}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (!seller.handle) {
    return content;
  }

  return <LocalizedClientLink href={`/sellers/${seller.handle}`}>{content}</LocalizedClientLink>;
};

function formatSellerJoinDate(value: unknown): string | null {
  if (value instanceof Date) {
    return isValid(value) ? format(value, 'yyyy-MM-dd') : null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isValid(date) ? format(date, 'yyyy-MM-dd') : null;
  }

  return null;
}
