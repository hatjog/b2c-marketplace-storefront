'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/atoms';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  label: string | React.ReactNode;
  className?: string;
}

export function RefreshButton({ label, className }: RefreshButtonProps) {
  const router = useRouter();

  return (
    <Button
      onClick={() => router.refresh()}
      className={cn('max-w-fit', className)}
    >
      {label}
    </Button>
  );
}
