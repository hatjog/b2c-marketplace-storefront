/**
 * ProductListingSkeleton — BonBeauty DS aligned loading skeleton.
 *
 * v1.7.0 Story 2.1: Replaced raw hardcoded borders (border-white) with
 * --bb-border-soft token (rgba(144,112,50,0.14)) from bb-surfaces.css.
 * Skeleton fill uses bg-secondary token (neutral-25) which is already
 * token-bound. Added aria-busy + role="status" per WCAG 2.1 AA loading state.
 *
 * Source tokens: src/styles/tokens/bb-surfaces.css (--bb-border-soft),
 *                src/app/colors.css (--bg-secondary via Tailwind bg-secondary)
 */
export const ProductListingSkeleton = () => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Ładowanie listy produktów..."
      className="py-4"
      data-testid="product-listing-skeleton"
    >
      <span className="sr-only">Ładowanie listy produktów...</span>
      <div className="items-center justify-between lg:flex lg:h-10">
        <div className="h-6 w-20 animate-pulse rounded-sm bg-secondary" />
        <div className="hidden h-10 w-[200px] animate-pulse rounded-sm bg-secondary lg:block" />
        <div className="mb-2 mt-4 flex gap-2 lg:hidden">
          <div className="h-[38px] w-1/2 animate-pulse rounded-sm bg-secondary" />
          <div className="h-[38px] w-1/2 animate-pulse rounded-sm bg-secondary" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4">
        <div>
          <div
            className="h-80 animate-pulse rounded-sm border bg-secondary"
            style={{ borderColor: 'var(--bb-border-soft, rgba(144,112,50,0.14))' }}
          />
          <div
            className="h-80 animate-pulse rounded-sm border bg-secondary"
            style={{ borderColor: 'var(--bb-border-soft, rgba(144,112,50,0.14))' }}
          />
          <div
            className="h-80 animate-pulse rounded-sm border bg-secondary"
            style={{ borderColor: 'var(--bb-border-soft, rgba(144,112,50,0.14))' }}
          />
        </div>
        <div className="col-span-3">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-[600px] animate-pulse rounded-sm border bg-secondary"
                style={{ borderColor: 'var(--bb-border-soft, rgba(144,112,50,0.14))' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
