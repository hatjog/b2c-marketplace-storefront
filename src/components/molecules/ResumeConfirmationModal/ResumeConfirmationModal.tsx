'use client';

import { useEffect, useId } from 'react';
import { useTranslations } from 'next-intl';

import { setPauseState } from '@/lib/helpers/voucher-pause-state';

/**
 * Story v160-6-4: ResumeConfirmationModal molecule — informed-friction gate
 * before re-enabling Claim CTA. Aligns with FR7 GDPR Art. 7 informed consent
 * posture (deliberate user gesture mandatory for consent-relevant actions).
 *
 * A11y: role="dialog" + aria-modal="true" + aria-labelledby; ESC key + backdrop
 * click both invoke `onCancel`. Focus trap is OUT OF 6.4 scope (defer to 6.4.1
 * polish if QA flags); body remains scrollable behind the backdrop.
 */

export interface ResumeConfirmationModalProps {
  open: boolean;
  code: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResumeConfirmationModal({
  open,
  code,
  onConfirm,
  onCancel
}: ResumeConfirmationModalProps) {
  const t = useTranslations('voucher.consent_pause');
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleConfirm() {
    setPauseState(code, false);
    onConfirm();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="voucher-resume-modal"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <button
        type="button"
        aria-label={t('resume_cancel')}
        data-testid="voucher-resume-modal-backdrop"
        onClick={onCancel}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative z-10 mx-4 flex max-w-md flex-col gap-4 rounded-[var(--bb-radius-card)] border border-tertiary bg-primary p-6 shadow-lg">
        <h3 id={titleId} className="heading-sm">
          {t('resume_modal_title')}
        </h3>
        <p className="text-secondary">{t('resume_modal_body')}</p>
        <div className="flex flex-row-reverse gap-2">
          <button
            type="button"
            data-testid="voucher-resume-modal-confirm"
            onClick={handleConfirm}
            className="min-h-12 rounded-[var(--bb-radius-card)] bg-action px-4 py-2 text-action-on-primary"
          >
            {t('resume_confirm')}
          </button>
          <button
            type="button"
            data-testid="voucher-resume-modal-cancel"
            onClick={onCancel}
            className="min-h-12 rounded-[var(--bb-radius-card)] border border-tertiary px-4 py-2 text-secondary"
          >
            {t('resume_cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
