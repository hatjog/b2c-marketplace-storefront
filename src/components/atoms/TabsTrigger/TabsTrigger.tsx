import { cn } from '@/lib/utils';

export const TabsTrigger = ({
  children,
  isActive,
  'data-testid': dataTestId
}: {
  children: React.ReactNode;
  isActive: boolean;
  'data-testid'?: string;
}) => {
  return (
    <p
      className={cn(
        'cursor-pointer whitespace-nowrap px-2 pb-2 capitalize',
        isActive && 'border-b border-primary font-bold'
      )}
      data-testid={dataTestId ?? 'tabs-trigger'}
    >
      {children}
    </p>
  );
};
