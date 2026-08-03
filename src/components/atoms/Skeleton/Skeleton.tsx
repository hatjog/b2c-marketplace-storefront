'use client';

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
import { useTranslations } from 'next-intl';

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
  /** v1.7.0 Story 2.1 review fix (LOW): mark as visual-only when nested
   *  inside a parent that already announces a loading region. Suppresses
   *  duplicate "Ładowanie..." announcements. */
  decorative?: boolean;
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
  'aria-label': ariaLabelProp,
  decorative = false,
  'data-testid': dataTestId,
}: SkeletonProps) {
  const t = useTranslations('common');
  const ariaLabel = ariaLabelProp ?? t('loading');

  // v1.7.0 Story 2.1 review fix (LOW): when nested under a parent loading region
  // (SkeletonText / SkeletonCard already announce status), render as decorative
  // (aria-hidden) so SR users hear "Ładowanie..." once, not 3-5 times.
  if (decorative) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'animate-pulse',
          roundedClasses[rounded],
          width,
          height,
          className
        )}
        style={{ backgroundColor: 'var(--bb-skeleton-base, rgba(239,229,210,0.52))' }}
        data-testid={dataTestId ?? 'skeleton'}
      />
    );
  }
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
  decorative = false,
  'data-testid': dataTestId,
}: {
  lines?: number;
  className?: string;
  /** v1.7.0 Story 2.1 review fix (LOW): suppress role/aria-busy when nested in
   *  another loading region (e.g., inside SkeletonCard). */
  decorative?: boolean;
  'data-testid'?: string;
}) {
  const t = useTranslations('common');
  const loadingTextLabel = t('loading_text');
  const containerProps = decorative
    ? ({ 'aria-hidden': 'true' } as const)
    : ({
        role: 'status',
        'aria-busy': 'true',
        'aria-label': loadingTextLabel,
      } as const);
  return (
    <div
      {...containerProps}
      className={cn('flex flex-col gap-2', className)}
      data-testid={dataTestId ?? 'skeleton-text'}
    >
      {!decorative && <span className="sr-only">{loadingTextLabel}</span>}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}
          height="h-4"
          rounded="sm"
          decorative
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
  const t = useTranslations('common');
  const loadingCardLabel = t('loading_product_card');

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingCardLabel}
      className={cn(
        'flex flex-col gap-3 rounded-md p-4',
        className
      )}
      style={{ backgroundColor: 'var(--bb-skeleton-base, rgba(239,229,210,0.52))' }}
      data-testid={dataTestId ?? 'skeleton-card'}
    >
      <span className="sr-only">{loadingCardLabel}</span>
      {/* Image area — decorative: parent SkeletonCard already announces loading */}
      <Skeleton height="h-[200px]" rounded="sm" decorative />
      {/* Title — decorative SkeletonText (suppress nested status announcement) */}
      <SkeletonText lines={2} decorative />
      {/* Price */}
      <Skeleton width="w-1/3" height="h-5" rounded="sm" decorative />
    </div>
  );
}
