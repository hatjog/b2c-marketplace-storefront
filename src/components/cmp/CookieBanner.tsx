'use client';

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

import { type ReactElement, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

import { acceptAll, getConsent, rejectAll } from '@/lib/consent';
import { ConsentModal } from './ConsentModal';

// ---------------------------------------------------------------------------
// Banner copy (pl / en / ua / de)
// ---------------------------------------------------------------------------

interface BannerCopy {
  heading: string;
  body: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  privacyLink: string;
  privacyLinkHref: string;
}

const BANNER_COPY: Record<string, BannerCopy> = {
  pl: {
    heading: 'Ta strona używa plików cookie',
    body: 'Używamy plików cookie, aby zapewnić prawidłowe działanie strony (niezbędne) oraz — za Twoją zgodą — do zapamiętywania preferencji, analityki i marketingu. Możesz zaakceptować wszystkie, odrzucić opcjonalne lub dostosować wybór.',
    acceptAll: 'Akceptuj wszystkie',
    rejectAll: 'Odrzuć opcjonalne',
    customize: 'Dostosuj',
    privacyLink: 'Polityka prywatności',
    privacyLinkHref: '/pl/privacy'
  },
  en: {
    heading: 'This site uses cookies',
    body: 'We use cookies to ensure the site works correctly (necessary) and — with your consent — to remember preferences, analytics, and marketing. You can accept all, reject optional ones, or customise your choices.',
    acceptAll: 'Accept all',
    rejectAll: 'Reject optional',
    customize: 'Customise',
    privacyLink: 'Privacy policy',
    privacyLinkHref: '/en/privacy'
  },
  ua: {
    heading: 'Цей сайт використовує файли cookie',
    body: "Ми використовуємо файли cookie для забезпечення роботи сайту (необхідні) та — з Вашої згоди — для збереження налаштувань, аналітики та маркетингу. Ви можете прийняти всі, відхилити необов'язкові або налаштувати вибір.",
    acceptAll: 'Прийняти всі',
    rejectAll: "Відхилити необов'язкові",
    customize: 'Налаштувати',
    privacyLink: 'Політика конфіденційності',
    privacyLinkHref: '/ua/privacy'
  },
  de: {
    heading: 'Diese Website verwendet Cookies',
    body: 'Wir verwenden Cookies, um den ordnungsgemäßen Betrieb der Website sicherzustellen (notwendig) und — mit Ihrer Einwilligung — für Einstellungen, Analysen und Marketing. Sie können alle akzeptieren, optionale ablehnen oder Ihre Auswahl anpassen.',
    acceptAll: 'Alle akzeptieren',
    rejectAll: 'Optionale ablehnen',
    customize: 'Anpassen',
    privacyLink: 'Datenschutzerklärung',
    privacyLinkHref: '/de/privacy'
  }
};

function getCopy(locale: string): BannerCopy {
  return BANNER_COPY[locale] ?? BANNER_COPY['en'];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CookieBanner(): ReactElement | null {
  const locale = useLocale();
  const copy = getCopy(locale);

  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Show banner only when no consent cookie exists
    const state = getConsent();
    if (!state) {
      setVisible(true);
    }
  }, []);

  function handleAcceptAll(): void {
    acceptAll();
    setVisible(false);
  }

  function handleRejectAll(): void {
    rejectAll();
    setVisible(false);
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
    }
  }

  if (!visible) return null;

  return (
    <>
      <div
        role="region"
        aria-label={copy.heading}
        data-testid="cookie-banner"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-tertiary/20 bg-primary px-4 py-4 shadow-lg sm:px-6"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-secondary">{copy.heading}</p>
            <p className="mt-1 text-sm text-tertiary">
              {copy.body}{' '}
              <a
                href={copy.privacyLinkHref}
                className="underline hover:text-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.privacyLink}
              </a>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleCustomize}
              data-testid="cookie-banner-customize"
              className="min-h-10 rounded-sm border border-tertiary px-4 py-2 text-sm font-medium hover:bg-tertiary/10"
            >
              {copy.customize}
            </button>
            {/* Reject all: equally prominent as Accept all — no dark pattern */}
            <button
              type="button"
              onClick={handleRejectAll}
              data-testid="cookie-banner-reject-all"
              className="min-h-10 rounded-sm border border-tertiary px-4 py-2 text-sm font-medium hover:bg-tertiary/10"
            >
              {copy.rejectAll}
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              data-testid="cookie-banner-accept-all"
              className="min-h-10 rounded-sm bg-action px-4 py-2 text-sm font-medium text-action-on-primary"
            >
              {copy.acceptAll}
            </button>
          </div>
        </div>
      </div>
      {modalOpen && (
        <ConsentModal
          locale={locale}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
