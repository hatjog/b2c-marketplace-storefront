import React from 'react';

import { AlertIcon } from '@/icons';
import { cn } from '@/lib/utils';

type AlertVariant = 'base' | 'base-inverse' | 'brand' | 'positive' | 'negative' | 'neutral';

interface AlertProps {
  variant?: AlertVariant;
  icon?: React.ReactNode | boolean;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

const variantStyles: Record<AlertVariant, { container: string; text: string; icon: string }> = {
  base: {
    container: 'bg-component-primary border border-primary',
    text: 'text-primary',
    icon: '#090909'
  },
  'base-inverse': {
    container: 'bg-tertiary border border-secondary',
    text: 'text-tertiary',
    icon: '#fff'
  },
  brand: {
    container: 'bg-action-secondary',
    text: 'text-action-on-secondary',
    icon: '#090909'
  },
  positive: {
    container: 'border border-emerald-200 bg-emerald-50',
    text: 'text-emerald-900',
    icon: '#166534'
  },
  negative: {
    container: 'border border-rose-200 bg-rose-50',
    text: 'text-rose-900',
    icon: '#be123c'
  },
  neutral: {
    container: 'border border-[var(--bb-border-soft)] bg-[var(--bb-surface-3-72)]',
    text: 'text-primary',
    icon: '#090909'
  }
};

export const Alert = ({
  variant = 'base',
  icon,
  title,
  children,
  className,
  'data-testid': dataTestId
}: AlertProps) => {
  const styles = variantStyles[variant];
  const iconOnly = icon && !title;

  return (
    <div
      role="status"
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-sm px-3 py-2',
        styles.container,
        className,
        iconOnly && 'p-2.5'
      )}
      data-testid={dataTestId ?? 'alert'}
    >
      {icon && (
        <div className="flex-shrink-0">
          {typeof icon === 'boolean' || icon === undefined ? (
            <AlertIcon
              color={styles.icon}
              size={16}
            />
          ) : (
            icon
          )}
        </div>
      )}
      {title && <p className={cn('label-sm', styles.text)}>{title}</p>}
      {children ? <div className={cn('label-sm', styles.text)}>{children}</div> : null}
    </div>
  );
};
