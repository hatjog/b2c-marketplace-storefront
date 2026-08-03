'use client';

/**
 * ProductListingSkeleton — BonBeauty DS aligned loading skeleton.
 *
 * v1.7.0 Story 2.1: Replaced raw hardcoded borders (border-white) with
 * --bb-border-soft token (rgba(144,112,50,0.14)) from bb-surfaces.css.
 * Skeleton fill uses bg-secondary token (neutral-25) which is already
 * token-bound. Added aria-busy + role="status" per WCAG 2.1 AA loading state.
 *
 * v1.7.0 Story 2.1 review-2 fix (LOW/2): inline `animate-pulse rounded-sm
 *   bg-secondary` divs migrated to the shared `Skeleton` primitive with
 *   `decorative` flag, so the outer `role="status"` is the only announced
 *   live region (no nested re-announcements) and the `Skeleton` primitive
 *   gains a second shipping consumer beyond `SkeletonProductCard`.
 *
 * Source tokens: src/styles/tokens/bb-surfaces.css (--bb-border-soft),
 *                src/app/colors.css (--bg-secondary via Tailwind bg-secondary)
 */
import { Skeleton } from '@/components/atoms/Skeleton/Skeleton';
import { useTranslations } from 'next-intl';

const BORDER_STYLE = { borderColor: 'var(--bb-border-soft, rgba(144,112,50,0.14))' };

export const ProductListingSkeleton = () => {
  const t = useTranslations('common');
  const loadingLabel = t('loading_product_list');

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      className="py-4"
      data-testid="product-listing-skeleton"
    >
      <span className="sr-only">{loadingLabel}</span>
      <div className="items-center justify-between lg:flex lg:h-10">
        <Skeleton width="w-20" height="h-6" rounded="sm" decorative />
        <div className="hidden lg:block">
          <Skeleton width="w-[200px]" height="h-10" rounded="sm" decorative />
        </div>
        <div className="mb-2 mt-4 flex gap-2 lg:hidden">
          <Skeleton width="w-1/2" height="h-[38px]" rounded="sm" decorative />
          <Skeleton width="w-1/2" height="h-[38px]" rounded="sm" decorative />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4">
        <div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-sm border bg-secondary"
              style={BORDER_STYLE}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="col-span-3">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-[600px] animate-pulse rounded-sm border bg-secondary"
                style={BORDER_STYLE}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
