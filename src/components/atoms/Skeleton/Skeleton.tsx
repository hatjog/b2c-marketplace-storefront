/**
 * Skeleton — BonBeauty DS foundational loading state atom.
 *
 * v1.7.0 Story 2.1: BonBeauty-aligned surface treatment (warm muted token,
 * not raw gray) with aria-busy/screen reader label per WCAG 2.1 AA.
 *
 * Uses --bb-skeleton-base (rgba(239,229,210,0.52) — bb-surface-muted)
 * and --bb-skeleton-shimmer for animate-pulse shimmer, both defined in
 * src/styles/tokens/bb-surfaces.css.
 *
 * WCAG 2.1:
 *   - aria-busy="true" on the container informs AT that content is loading
 *   - Screen reader label ("Ładowanie...") provided as visually-hidden text
 *   - animate-pulse respects prefers-reduced-motion via globals.css media rule
 *
 * UX-PAT-4: loading state treatment — not raw gray, BonBeauty surface-muted.
 * ARCH-007: BonBeauty DS customer-facing storefront only.
 */
import { cn } from '@/lib/utils';

interface SkeletonProps {
  /** Width — Tailwind class or style (e.g. 'w-full', 'w-[200px]') */
  width?: string;
  /** Height — Tailwind class or style (e.g. 'h-4', 'h-[60px]') */
  height?: string;
  /** Border radius variant */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** Additional class overrides */
  className?: string;
  /** Screen reader label for this skeleton element */
  'aria-label'?: string;
  'data-testid'?: string;
}

const roundedClasses: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: 'rounded-none',
  sm:   'rounded-sm',
  md:   'rounded-md',
  lg:   'rounded-lg',
  full: 'rounded-full',
};

export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  rounded = 'sm',
  className,
  'aria-label': ariaLabel = 'Ładowanie...',
  'data-testid': dataTestId,
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn(
        'animate-pulse',
        roundedClasses[rounded],
        width,
        height,
        className
      )}
      style={{ backgroundColor: 'var(--bb-skeleton-base, rgba(239,229,210,0.52))' }}
      data-testid={dataTestId ?? 'skeleton'}
    >
      {/* Visually hidden screen reader text */}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

/**
 * SkeletonText — inline text skeleton variant.
 * Used for paragraph/heading placeholders.
 */
export function SkeletonText({
  lines = 1,
  className,
  'data-testid': dataTestId,
}: {
  lines?: number;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Ładowanie tekstu..."
      className={cn('flex flex-col gap-2', className)}
      data-testid={dataTestId ?? 'skeleton-text'}
    >
      <span className="sr-only">Ładowanie tekstu...</span>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}
          height="h-4"
          rounded="sm"
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard — product card sized skeleton.
 * Replaces raw bg-gray-200 used in SkeletonProductCard.
 */
export function SkeletonCard({
  className,
  'data-testid': dataTestId,
}: {
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Ładowanie karty produktu..."
      className={cn(
        'flex flex-col gap-3 rounded-md p-4',
        className
      )}
      style={{ backgroundColor: 'var(--bb-skeleton-base, rgba(239,229,210,0.52))' }}
      data-testid={dataTestId ?? 'skeleton-card'}
    >
      <span className="sr-only">Ładowanie karty produktu...</span>
      {/* Image area */}
      <Skeleton height="h-[200px]" rounded="sm" />
      {/* Title */}
      <SkeletonText lines={2} />
      {/* Price */}
      <Skeleton width="w-1/3" height="h-5" rounded="sm" />
    </div>
  );
}
