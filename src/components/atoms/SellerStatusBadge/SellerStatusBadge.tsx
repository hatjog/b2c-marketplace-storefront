'use client';

/**
 * SellerStatusBadge — Vendor lifecycle status pill (4 variants).
 *
 * Story: v160-3-6-vendor-lifecycle-status-i18n (Sprint 3, Epic 3).
 * Spec: ux-design-specification.md UX-DR79 (color-coded variants) + UX-DR80
 * (i18n surface). Mercur 2.1.1 backend Vendor lifecycle enum:
 *   `pending_approval` | `open` | `suspended` | `terminated`.
 *
 * Atomic level: pure presentation, no state, no effect.
 * i18n: `useTranslations('seller.status')` namespace — keys mirror enum values
 * (lower_snake_case) so caller passes raw backend status without mapping.
 *
 * Color semantics (UX-DR79):
 *   - open            → trust   (verified / active)
 *   - pending_approval → yellow  (caution / awaiting)
 *   - suspended        → orange  (warning / temporary)
 *   - terminated       → gray    (inactive / final)
 *
 * v1.6.0 wire-up: OPCJA B (component-only). Mercur 2 storefront API
 * (`mercurClient.store.sellers.query()`) does NOT expose `status` on
 * `SellerListItem` / `SellerProps` — middleware filters to `open` only
 * pre-API per memory `project_v160_sprint1_1_7_1_signal3_split.md`.
 * Component authored for downstream surfaces (Phase B activation, Epic 4
 * filter chips, Epic 5 PDP seller card) once backend exposure lands via
 * story 1.7.1 Signal 3 follow-up.
 */

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type SellerStatus = 'pending_approval' | 'open' | 'suspended' | 'terminated';

export interface SellerStatusBadgeProps {
  /** Vendor lifecycle status (Mercur 2.1.1 backend enum). */
  status: SellerStatus;
  /** Optional className passthrough for layout integration. */
  className?: string;
}

const STATUS_CLASSES: Record<SellerStatus, string> = {
  open: 'bg-[var(--color-trust)] text-white',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-orange-100 text-orange-800',
  terminated: 'bg-gray-100 text-gray-800',
};

export const SellerStatusBadge = ({ status, className }: SellerStatusBadgeProps) => {
  const t = useTranslations('seller.status');

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_CLASSES[status],
        className
      )}
      data-testid="seller-status-badge"
      data-status={status}
    >
      {t(status)}
    </span>
  );
};
