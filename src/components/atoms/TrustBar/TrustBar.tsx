// TrustBar — horizontal trust strip for PDP / checkout surfaces.
// DS v2.1.0 token-bound: color-trust, bb-surface, bb-border-soft.

import { cn } from '@/lib/utils';

interface TrustItem {
  icon: string;
  label: string;
}

const DEFAULT_ITEMS: TrustItem[] = [
  { icon: '🔒', label: 'Bezpieczna płatność' },
  { icon: '✓', label: 'Zweryfikowany salon' },
  { icon: '↩', label: 'Zwrot w 14 dni' },
];

interface TrustBarProps {
  items?: TrustItem[];
  className?: string;
  'data-testid'?: string;
}

export function TrustBar({
  items = DEFAULT_ITEMS,
  className,
  'data-testid': dataTestId = 'trust-bar',
}: TrustBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-[var(--radius-sm,12px)] border border-[var(--bb-border-hairline,var(--bb-border-soft))] bg-[var(--bb-surface)] px-4 py-2.5',
        className
      )}
      data-testid={dataTestId}
      aria-label="Gwarancje zakupu"
    >
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
