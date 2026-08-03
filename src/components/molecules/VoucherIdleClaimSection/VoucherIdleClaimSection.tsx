'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { PauseClaimToggle } from '@/components/atoms/PauseClaimToggle';
import { ResumeConfirmationModal } from '@/components/molecules/ResumeConfirmationModal';
import { getPauseState } from '@/lib/helpers/voucher-pause-state';

/**
 * Story v160-6-4: VoucherIdleClaimSection — client-side orchestration of
 * Claim CTA + PauseClaimToggle + ResumeConfirmationModal.
 *
 * Pause overlays the idle state without forking the backend state machine
 * (idle/consent_pending/claimed/withdrawn semantics from Story 6.1 are
 * preserved 1:1). When paused: hide Claim CTA + show resume button; resume
 * goes through the confirmation modal before re-enabling the CTA.
 *
 * Privacy invariant (AR45): pause state lives in sessionStorage as a
 * code-only marker (no buyer identifiers, no recipient PII).
 */

export interface VoucherIdleClaimSectionProps {
  code: string;
  /** Pre-rendered Claim CTA form (Server Component slot). */
  claimCta: ReactNode;
}

export function VoucherIdleClaimSection({
  code,
  claimCta
}: VoucherIdleClaimSectionProps) {
  const t = useTranslations('voucher.consent_pause');
  const [paused, setPaused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setPaused(getPauseState(code));
    setHydrated(true);
  }, [code]);

  // Pre-hydration: render the Claim CTA + pause toggle as if not paused.
  // This avoids SSR/CSR markup divergence; first useEffect tick reconciles.
  if (!hydrated || !paused) {
    return (
      <div className="flex flex-col gap-3" data-testid="voucher-idle-section">
        {claimCta}
        <PauseClaimToggle
          code={code}
          onPause={() => setPaused(true)}
        />
        <p className="label-sm text-secondary">{t('pause_persisted_notice')}</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3"
      data-testid="voucher-idle-section"
      data-paused="true"
    >
      <div
        data-testid="voucher-paused-badge"
        className="rounded-sm border border-tertiary bg-amber-50 p-4 text-amber-900"
      >
        <span className="heading-sm">{t('paused_badge')}</span>
        <p className="label-sm mt-1">{t('paused_helper')}</p>
      </div>
      <button
        type="button"
        data-testid="voucher-resume-button"
        onClick={() => setModalOpen(true)}
        className="min-h-12 rounded-sm bg-action px-6 py-3 text-action-on-primary"
      >
        {t('resume_button')}
      </button>
      <p className="label-sm text-secondary">{t('pause_persisted_notice')}</p>
      <ResumeConfirmationModal
        open={modalOpen}
        code={code}
        onConfirm={() => {
          setPaused(false);
          setModalOpen(false);
        }}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
