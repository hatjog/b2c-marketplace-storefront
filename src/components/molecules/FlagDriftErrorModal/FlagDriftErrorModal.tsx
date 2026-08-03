'use client';

import { useId, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { CloseIcon } from '@/icons';

/**
 * Story v160-5-9 — `FlagDriftErrorModal` molecule.
 *
 * User-facing error UX gdy `placeOrder` throws `FlagDriftError` (FM-9 race
 * window detected między cart-start snapshot a checkout submit). Per AC4:
 *   - title + message + primary CTA "Review cart" + optional close
 *   - `role="dialog"` + `aria-labelledby` + autoFocus na primary CTA
 *   - i18n via `seller.checkout.*` namespace (Story 3.4 unified)
 *   - `data-testid="flag-drift-error-modal"` na root container
 *
 * Per ADR-088-reassess: storefront komplementarny do backend mor-policy.
 *
 * Pure presentational — parent owns state, opens modal w catch path
 * (CartReview/PaymentButton).
 */

export interface FlagDriftErrorModalProps {
  open: boolean;
  onClose: () => void;
  onReviewCart: () => void;
}

export function FlagDriftErrorModal({
  open,
  onClose,
  onReviewCart
}: FlagDriftErrorModalProps): ReactElement | null {
  const t = useTranslations('seller.checkout');
  const titleId = useId();

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="flag-drift-error-modal"
      className="fixed left-0 top-0 z-30 flex h-full w-full justify-center"
    >
      <div
        className="absolute h-full w-full bg-tertiary/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute z-20 my-20 max-h-[80vh] w-full max-w-[600px] overflow-y-auto rounded-sm bg-primary py-5 shadow-lg"
        tabIndex={-1}
      >
        <div className="heading-md flex items-center justify-between border-b px-4 pb-5 uppercase">
          <span id={titleId}>{t('flag_changed_title')}</span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer"
            aria-label={t('flag_changed_close_cta')}
            data-testid="flag-drift-error-modal-close-icon"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 pt-5">
          <p className="text-base text-tertiary">{t('flag_changed_message')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="tonal"
              onClick={onClose}
              data-testid="flag-drift-error-modal-close-cta"
            >
              {t('flag_changed_close_cta')}
            </Button>
            <Button
              autoFocus
              onClick={onReviewCart}
              data-testid="flag-drift-error-modal-review-cta"
            >
              {t('review_cart_cta')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
