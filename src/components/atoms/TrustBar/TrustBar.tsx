import { cn } from '@/lib/utils';

interface TrustItem {
  label: string;
}

interface TrustBarProps {
  items: TrustItem[];
  ariaLabel: string;
  className?: string;
  'data-testid'?: string;
}

export function TrustBar({
  items,
  ariaLabel,
  className,
  'data-testid': dataTestId = 'trust-bar'
}: TrustBarProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 rounded-[var(--radius-sm,12px)] border border-[var(--bb-border-hairline,var(--bb-border-soft))] bg-[var(--bb-surface)] px-4 py-3 lg:grid-cols-4',
        className
      )}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      role="list"
    >
      {items.map(item => (
        <span
          key={item.label}
          className="inline-flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]"
          role="listitem"
        >
          <span
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--bb-trust-tint-10)] text-[var(--color-trust)]"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
