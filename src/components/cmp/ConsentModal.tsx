'use client';

/**
 * <ConsentModal> — per-category consent customisation modal (AC2).
 *
 * Story v160-cleanup-34: minimal in-house CMP.
 *
 * Categories:
 *   - necessary: always-on, greyed-out (no toggle)
 *   - preferences: UX preference persistence (pause state, wizard state)
 *   - analytics: PostHog telemetry (wired-but-gated in v1.6.0)
 *   - marketing: reserved for future ad partners
 *
 * Locales: pl / en / ua / de.
 * Uses native <dialog> for focus trap + ESC handling (D-66: zero-deps).
 */

import { type ReactElement, useEffect, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';

import { getConsent, setConsent } from '@/lib/consent';
import { clearPreferencesStorage } from '@/lib/consent';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ConsentModalProps {
  onClose: () => void;
}

export function ConsentModal({ onClose }: ConsentModalProps): ReactElement {
  const t = useTranslations('consent.modal');
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Initialise toggle states from existing consent (or default to false)
  const current = getConsent();
  const [preferences, setPreferences] = useState(current?.categories.preferences ?? false);
  const [analytics, setAnalytics] = useState(current?.categories.analytics ?? false);
  const [marketing, setMarketing] = useState(current?.categories.marketing ?? false);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (typeof node.showModal === 'function' && !node.open) {
      try {
        node.showModal();
        return;
      } catch {
        /* showModal can throw — fall through to attribute fallback */
      }
    }
    // F6: fallback for browsers without HTMLDialogElement.showModal support
    // (very old Safari). Set the `open` attribute so the dialog is visible;
    // role/aria-modal already set on the element. Native focus trap is lost
    // but the modal remains usable and dismissible via Save/ESC.
    if (!node.open) {
      try {
        node.setAttribute('open', '');
      } catch {
        /* ignore */
      }
    }
  }, []);

  function handleSave(): void {
    // If preferences toggled off, clear associated storage
    const prevPreferences = current?.categories.preferences ?? false;
    if (prevPreferences && !preferences) {
      clearPreferencesStorage();
    }
    setConsent({ preferences, analytics, marketing });
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDialogElement>): void {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('heading')}
      data-testid="consent-modal"
      onKeyDown={handleKeyDown}
      className="m-auto max-w-lg rounded-md bg-primary p-6 shadow-xl backdrop:bg-tertiary/60"
    >
      <h2 className="heading-md mb-4 text-secondary">{t('heading')}</h2>

      <div className="flex flex-col gap-4">
        {/* Necessary — always active, no toggle */}
        <div className="flex items-start justify-between gap-4 rounded-sm border border-tertiary/20 p-3">
          <div>
            <p className="text-sm font-semibold text-secondary">{t('categories.necessary.label')}</p>
            <p className="mt-1 text-xs text-tertiary">{t('categories.necessary.desc')}</p>
          </div>
          <span
            className="shrink-0 rounded-full bg-action/10 px-2 py-1 text-xs font-medium text-action"
            aria-label={t('always_active')}
          >
            {t('always_active')}
          </span>
        </div>

        {/* Preferences */}
        <CategoryToggle
          label={t('categories.preferences.label')}
          desc={t('categories.preferences.desc')}
          checked={preferences}
          id="cmp-preferences"
          onChange={setPreferences}
        />

        {/* Analytics */}
        <CategoryToggle
          label={t('categories.analytics.label')}
          desc={t('categories.analytics.desc')}
          checked={analytics}
          id="cmp-analytics"
          onChange={setAnalytics}
        />

        {/* Marketing */}
        <CategoryToggle
          label={t('categories.marketing.label')}
          desc={t('categories.marketing.desc')}
          checked={marketing}
          id="cmp-marketing"
          onChange={setMarketing}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          data-testid="consent-modal-save"
          className="min-h-10 rounded-sm bg-action px-6 py-2 text-sm font-medium text-action-on-primary"
        >
          {t('save_button')}
        </button>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// CategoryToggle
// ---------------------------------------------------------------------------

interface CategoryToggleProps {
  label: string;
  desc: string;
  checked: boolean;
  id: string;
  onChange: (v: boolean) => void;
}

function CategoryToggle({ label, desc, checked, id, onChange }: CategoryToggleProps): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 rounded-sm border border-tertiary/20 p-3">
      <div>
        <label
          htmlFor={id}
          className="text-sm font-semibold text-secondary"
        >
          {label}
        </label>
        <p className="mt-1 text-xs text-tertiary">{desc}</p>
      </div>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={`consent-toggle-${id.replace('cmp-', '')}`}
        className="mt-1 size-5 shrink-0 accent-action"
      />
    </div>
  );
}
