'use client';

import type { FieldError } from 'react-hook-form';

import { Input } from '@/components/atoms';
import { cn } from '@/lib/utils';

type LabeledInputProps = {
  label: string;
  error?: FieldError;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const LabeledInput = ({ error, label, className, ...props }: LabeledInputProps) => (
  <label className={cn('label-sm block', className)}>
    <p className={cn(error && 'text-negative')}>{label}</p>
    <Input
      error={!!error}
      {...props}
    />
    {error && <p className="label-sm text-negative">{error.message}</p>}
  </label>
);
