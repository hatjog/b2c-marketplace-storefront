'use client';

import { MinusHeavyIcon, TickThinIcon } from '@/icons';
import { cn } from '@/lib/utils';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
  error?: boolean;
  label?: React.ReactNode;
  'data-testid'?: string;
}

export function Checkbox({
  label,
  indeterminate,
  error,
  className,
  checked,
  'data-testid': dataTestId,
  ...props
}: CheckboxProps) {
  const inputAriaLabel =
    typeof label === 'string' && label.trim().length > 0
      ? label
      : props['aria-label'];

  return (
    <label className="flex cursor-pointer items-center gap-2">
      <span
        className={cn(
          'checkbox-wrapper',
          checked && '!bg-action',
          error && '!border-negative',
          indeterminate && '!bg-action',
          props.disabled && '!cursor-default !border-disabled !bg-disabled',
          className
        )}
      >
        {indeterminate && !checked && !props.disabled && <MinusHeavyIcon size={20} />}
        {checked && !props.disabled && <TickThinIcon size={20} />}

        <input
          type="checkbox"
          className={cn(
            'h-[20px] w-[20px] cursor-pointer opacity-0',
            props.disabled && 'cursor-default'
          )}
          data-testid={dataTestId ?? 'checkbox'}
          aria-label={inputAriaLabel}
          {...props}
        />
      </span>
      {label}
    </label>
  );
}
