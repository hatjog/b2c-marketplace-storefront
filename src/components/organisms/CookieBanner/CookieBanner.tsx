'use client';

// @chrome-manifest: W6-04
// CookieBanner — Wave 6 chrome W6-04. v1.8.0 BonBeauty DS cookie banner.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/cookie-banner.yaml
// CSS custom properties consumed: --bb-surface, --bb-surface-strong, --bb-shadow-lift,
//   --bb-border-soft, --bg-action, --bg-action-hover, --text-primary, --text-secondary,
//   --text-on-action, --bb-radius-panel, --font-body, --font-weight-medium,
//   --space-4, --space-6, --anim-duration-base, --anim-ease-standard
// Exposed: --cookie-banner-z (200), --cookie-banner-bottom-offset (0px)
//
// Marek (privacy persona) 2-step delta per UX 2026-05-13:
//   Step 1 (default-3-CTA): Accept all / Reject all / Dostosuj
//   Step 2 (dostosuj-sub-modal): per-category consent toggles

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

export interface CookiePreferences {
  necessary: true;
  statistics: boolean;
  marketing: boolean;
  personalization: boolean;
}

export interface CookieBannerProps {
  locale: string;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onCustomize?: (prefs: CookiePreferences) => void;
  initialPreferences?: CookiePreferences | null;
  className?: string;
}

type CategoryKey = 'statistics' | 'marketing' | 'personalization';

const TOGGLE_CATEGORIES: CategoryKey[] = [
  'statistics',
  'marketing',
  'personalization',
];

export function CookieBanner({
  locale: _locale,
  onAcceptAll,
  onRejectAll,
  onCustomize,
  initialPreferences,
  className,
}: CookieBannerProps) {
  const t = useTranslations('cookie_banner');
  const [step, setStep] = useState<'banner' | 'sub-modal'>('banner');
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    statistics: initialPreferences?.statistics ?? false,
    marketing: initialPreferences?.marketing ?? false,
    personalization: initialPreferences?.personalization ?? false,
  });

  const subModalRef = useFocusTrap<HTMLDivElement>({
    active: step === 'sub-modal',
    onEscape: () => setStep('banner'),
    lockScroll: false,
  });

  function toggle(key: CategoryKey) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-[var(--cookie-banner-bottom-offset,0px)]',
        'z-[var(--cookie-banner-z,200)]',
        className
      )}
      style={
        {
          '--cookie-banner-z': '200',
          '--cookie-banner-bottom-offset': '0px',
        } as React.CSSProperties
      }
    >
      {step === 'banner' && (
        <section
          role="alertdialog"
          aria-label={t('aria_label')}
          aria-describedby="cookie-banner-desc"
          data-testid="cookie-banner"
          data-variant="default-3-CTA"
          className={cn(
            'mx-auto flex max-w-5xl flex-col gap-[var(--space-4,16px)] p-[var(--space-6,24px)]',
            'rounded-t-[var(--bb-radius-panel,16px)] border border-[var(--bb-border-soft)]',
            'bg-[var(--bb-surface)] shadow-[var(--bb-shadow-lift)] md:flex-row md:items-center md:justify-between'
          )}
        >
          <p
            id="cookie-banner-desc"
            className="text-sm text-[var(--text-secondary)]"
          >
            {t('description')}{' '}
            <a
              href={`/${_locale}/privacy-policy`}
              className="underline hover:text-[var(--text-primary)]"
              data-testid="cookie-banner-legal-link"
            >
              {t('privacy_policy')}
            </a>
          </p>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              variant="tonal"
              onClick={() => setStep('sub-modal')}
              data-testid="cookie-banner-customize"
            >
              {t('customize')}
            </Button>
            <Button
              variant="tonal"
              onClick={onRejectAll}
              data-testid="cookie-banner-reject-all"
            >
              {t('reject_all')}
            </Button>
            <Button
              onClick={onAcceptAll}
              data-testid="cookie-banner-accept-all"
            >
              {t('accept_all')}
            </Button>
          </div>
        </section>
      )}

      {step === 'sub-modal' && (
        <div
          className="fixed inset-0 z-[var(--cookie-banner-z,200)] flex items-center justify-center bg-[rgba(9,9,9,0.6)] p-4"
          aria-hidden={false}
        >
          <div
            ref={subModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('customize')}
            tabIndex={-1}
            data-testid="cookie-banner-sub-modal"
            data-variant="dostosuj-sub-modal"
            className={cn(
              'w-full max-w-md space-y-[var(--space-4,16px)] p-[var(--space-6,24px)]',
              'rounded-[var(--bb-radius-panel,16px)] border border-[var(--bb-border-soft)]',
              'bg-[var(--bb-surface)] shadow-[var(--bb-shadow-lift)]'
            )}
          >
            <h2 className="text-base font-[var(--font-weight-medium)] text-[var(--text-primary)]">
              {t('customize')}
            </h2>

            {/* Niezbędne — always-on (disabled toggle) */}
            <fieldset className="space-y-3">
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                    {t('category_necessary')}
                  </span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    {t('category_necessary_desc')}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked
                  disabled
                  aria-label={t('category_necessary')}
                  className="mt-1 h-4 w-4 accent-[var(--bg-action)]"
                  data-testid="cookie-cat-necessary"
                />
              </label>

              {TOGGLE_CATEGORIES.map((key) => (
                <label
                  key={key}
                  className="flex items-start justify-between gap-3"
                >
                  <span>
                    <span className="block text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                      {t(`category_${key}` as 'category_statistics')}
                    </span>
                    <span className="block text-xs text-[var(--text-secondary)]">
                      {t(`category_${key}_desc` as 'category_statistics_desc')}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={() => toggle(key)}
                    aria-label={t(`category_${key}` as 'category_statistics')}
                    className="mt-1 h-4 w-4 accent-[var(--bg-action)]"
                    data-testid={`cookie-cat-${key}`}
                  />
                </label>
              ))}
            </fieldset>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="tonal"
                onClick={() => setStep('banner')}
                data-testid="cookie-banner-back"
              >
                {t('back')}
              </Button>
              <Button
                onClick={() => onCustomize?.(prefs)}
                data-testid="cookie-banner-save"
              >
                {t('save_preferences')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
