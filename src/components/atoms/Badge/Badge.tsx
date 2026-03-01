import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function Badge({ children, className, 'data-testid': dataTestId }: BadgeProps) {
  return (
    <span
      className={cn(
        'label-sm inline-flex items-center justify-center rounded-xs bg-action px-2 py-1 leading-none text-action-on-primary',
        className
      )}
      data-testid={dataTestId ?? 'badge'}
    >
      {children}
    </span>
  );
}
