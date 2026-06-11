/**
 * SkeletonProductCard — BonBeauty DS aligned loading skeleton.
 *
 * v1.7.0 Story 2.1: Replaced raw bg-gray-200 with --bb-skeleton-base token
 * (bb-surface-muted, rgba(239,229,210,0.52)) from bb-surfaces.css.
 * Added aria-busy and role="status" per WCAG 2.1 + UX-PAT-4 loading state.
 *
 * v1.7.0 Story 2.1 review fix (MEDIUM): now consumes the new Skeleton primitive
 * directly — closes "primitives exported but never imported in real code paths"
 * finding by giving Skeleton at least one shipping consumer.
 *
 * Source token: src/styles/tokens/bb-surfaces.css --bb-skeleton-base
 */
import { Skeleton } from '@/components/atoms/Skeleton/Skeleton';

export const SkeletonProductCard = () => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Ładowanie karty produktu..."
      className="group relative flex h-[338px] w-full flex-col justify-between rounded-[var(--bb-radius-card)] border p-1"
      style={{ backgroundColor: 'var(--bb-skeleton-base, rgba(239,229,210,0.52))' }}
      data-testid="skeleton-product-card"
    >
      <span className="sr-only">Ładowanie karty produktu...</span>
      {/* Decorative inner skeletons — parent already announces loading state. */}
      <Skeleton height="h-[200px]" rounded="sm" decorative />
      <div className="flex flex-col gap-2 p-2">
        <Skeleton width="w-3/4" height="h-4" rounded="sm" decorative />
        <Skeleton width="w-1/3" height="h-4" rounded="sm" decorative />
      </div>
    </div>
  );
};
