import { LoaderIcon } from '@/icons';
import { cn } from '@/lib/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'filled' | 'tonal' | 'icon';
  size?: 'small' | 'large';
  loading?: boolean;
  'data-testid'?: string;
}

export function IconButton({
  icon,
  variant = 'filled',
  size = 'small',
  loading = false,
  className,
  'data-testid': dataTestId,
  ...props
}: IconButtonProps) {
  const variantClasses = {
    filled: 'button-filled',
    tonal: 'button-tonal',
    icon: 'button-icon'
  };

  const sizeClasses = {
    small: 'h-[40px] w-[40px]',
    large: 'h-[48px] w-[48px]'
  };

  return (
    <button
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        'flex items-center justify-center rounded-sm motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out',
        className
      )}
      data-testid={dataTestId ?? 'icon-button'}
      {...props}
    >
      {loading ? <LoaderIcon /> : icon}
    </button>
  );
}
