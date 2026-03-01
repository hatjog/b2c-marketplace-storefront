import { cn } from '@/lib/utils';

export const Card = ({
  children,
  className,
  'data-testid': dataTestId,
  ...props
}: {
  children: React.ReactNode;
  'data-testid'?: string;
} & React.ComponentPropsWithoutRef<'div'>) => {
  return (
    <div
      className={cn('rounded-sm border px-2 py-4', className)}
      data-testid={dataTestId ?? 'card'}
      {...props}
    >
      {children}
    </div>
  );
};
