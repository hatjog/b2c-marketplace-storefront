'use client';

// @chrome-manifest: W6-04
/**
 * <CookieBanner> — ePrivacy CMP cookie consent banner (AC2).
 *
 * Story v160-cleanup-34: minimal in-house CMP (no third-party SDK).
 * Vendor decision deferred to v1.7.0+ ADR.
 *
 * UX non-negotiables (ePrivacy + EDPB Guidelines 05/2020):
 *   - "Reject all" MUST be equally visible as "Accept all" (no dark patterns).
 *   - Banner is non-blocking (page interaction not prevented).
 *   - Banner disappears on any decision and does not reappear while cookie exists.
 *   - "Customize" opens <ConsentModal> for per-category control.
 *   - `necessary` category always-on and greyed-out in modal.
 *
 * Locales: pl / en / ua / de (OQ-3 auto-resolution: all 4 supported locales).
 * Uses next-intl `useLocale()` to select copy. Falls back to `en`.
 */
import { useEffect, useState, type ReactElement } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { acceptAll, clearPreferencesStorage, getConsent, rejectAll } from '@/lib/consent';

import { ConsentModal } from './ConsentModal';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Module-level event name for programmatic reopen (F5: withdrawal as easy as giving).
export const CONSENT_REOPEN_EVENT = 'gp:consent-reopen';

/** Programmatic reopen of the consent modal (e.g. footer "Cookie settings" link). */
export function openConsentModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_REOPEN_EVENT));
}

export function CookieBanner(): ReactElement | null {
  const locale = useLocale();
  const t = useTranslations('consent.banner');

  const [visible, setVisible] = useState(false);
  const [hasDecision, setHasDecision] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Show banner only when no consent cookie exists
    const state = getConsent();
    if (!state) {
      setVisible(true);
    } else {
      setHasDecision(true);
    }

    // Programmatic reopen handler (F5)
    function onReopen(): void {
      setModalOpen(true);
    }
    window.addEventListener(CONSENT_REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, onReopen);
  }, []);

  function handleAcceptAll(): void {
    acceptAll();
    setVisible(false);
    setHasDecision(true);
  }

  function handleRejectAll(): void {
    rejectAll();
    // F2: ensure pre-existing storage is cleared on reject (defensive — idempotent)
    clearPreferencesStorage();
    setVisible(false);
    setHasDecision(true);
  }

  function handleCustomize(): void {
    setModalOpen(true);
  }

  function handleModalClose(): void {
    setModalOpen(false);
    // After modal saves, consent cookie exists — hide banner
    const state = getConsent();
    if (state) {
      setVisible(false);
      setHasDecision(true);
    }
  }

  // F5: After a decision exists, render a small "Cookie settings" reopen
  // affordance — withdrawal must be as easy as giving consent (EDPB 05/2020 §117).
  if (!visible) {
    if (!hasDecision) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          data-testid="cookie-settings-reopen"
          aria-label={t('customize')}
          className="bb-chrome-reopen hover:bg-[var(--bb-tint-gold-08)]"
        >
          {t('customize')}
        </button>
        {modalOpen && (
          <ConsentModal
            onClose={handleModalClose}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        role="region"
        aria-live="polite"
        aria-label={t('heading')}
        data-testid="cookie-banner"
        className="bb-chrome-banner"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t('heading')}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {t('body')}{' '}
              <a
                href={`/${locale}/privacy`}
                className="underline decoration-[var(--bb-tint-gold-24)] underline-offset-4 hover:text-[var(--text-primary)]"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('privacy_link')}
              </a>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleCustomize}
              data-testid="cookie-banner-customize"
              className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--bb-border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--bb-tint-gold-08)]"
            >
              {t('customize')}
            </button>
            {/* Reject all: equally prominent as Accept all — no dark pattern */}
            <button
              type="button"
              onClick={handleRejectAll}
              data-testid="cookie-banner-reject-all"
              className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--bb-border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--bb-tint-gold-08)]"
            >
              {t('reject_all')}
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              data-testid="cookie-banner-accept-all"
              className="min-h-10 rounded-[var(--radius-sm)] bg-[var(--cta)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--cta-hover)]"
            >
              {t('accept_all')}
            </button>
          </div>
        </div>
      </div>
      {modalOpen && (
        <ConsentModal
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
