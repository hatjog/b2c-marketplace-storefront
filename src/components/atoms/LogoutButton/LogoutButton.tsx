'use client';

import { useTranslations } from 'next-intl';

import { signout } from '@/lib/data/customer';
import { cn } from '@/lib/utils';

type LogoutButtonProps = {
  unstyled?: boolean;
  'data-testid'?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const LogoutButton: React.FC<LogoutButtonProps> = ({
  unstyled,
  className,
  children,
  'data-testid': dataTestId
}) => {
  const t = useTranslations('header');

  const handleLogout = async () => {
    await signout();
  };

  return (
    <button
      onClick={handleLogout}
      className={cn(!unstyled && 'label-md my-3 px-4 py-3 uppercase md:my-0', className)}
      data-testid={dataTestId}
    >
      {children || t('logout')}
    </button>
  );
};
