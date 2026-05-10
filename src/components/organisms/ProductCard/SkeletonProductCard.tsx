/**
 * SkeletonProductCard — BonBeauty DS aligned loading skeleton.
 *
 * v1.7.0 Story 2.1: Replaced raw bg-gray-200 with --bb-skeleton-base token
 * (bb-surface-muted, rgba(239,229,210,0.52)) from bb-surfaces.css.
 * Added aria-busy and role="status" per WCAG 2.1 + UX-PAT-4 loading state.
 *
 * Source token: src/styles/tokens/bb-surfaces.css --bb-skeleton-base
 */
export const SkeletonProductCard = () => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Ładowanie karty produktu..."
      className="group relative flex h-[338px] w-full animate-pulse flex-col justify-between rounded-sm border p-1"
      style={{ backgroundColor: 'var(--bb-skeleton-base, rgba(239,229,210,0.52))' }}
      data-testid="skeleton-product-card"
    >
      <span className="sr-only">Ładowanie karty produktu...</span>
    </div>
  );
};
