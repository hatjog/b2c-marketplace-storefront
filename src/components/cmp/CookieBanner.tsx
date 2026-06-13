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

import { acceptAll, clearPreferencesStorage, getConsent, rejectAll } from '@/lib/consent';

import { ConsentModal } from './ConsentModal';

// Read locale defensively without next-intl context — CookieBanner is mounted in
// the root `app/layout.tsx` (above the [locale] segment where NextIntlClientProvider
// lives), so `useLocale()` would throw "No intl context found" at runtime (F1).
// Fallback chain: `_gp_lang` cookie → <html lang> → 'en'.
function readLocaleClient(): string {
  if (typeof document === 'undefined') return 'en';
  try {
    const cookieMatch = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('_gp_lang='));
    if (cookieMatch) {
      const value = decodeURIComponent(cookieMatch.slice('_gp_lang='.length));
      if (value) return value;
    }
  } catch {
    /* ignore — fall through */
  }
  const htmlLang = document.documentElement?.lang;
  return htmlLang || 'en';
}

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

// Module-level event name for programmatic reopen (F5: withdrawal as easy as giving).
export const CONSENT_REOPEN_EVENT = 'gp:consent-reopen';

/** Programmatic reopen of the consent modal (e.g. footer "Cookie settings" link). */
export function openConsentModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_REOPEN_EVENT));
}

export function CookieBanner(): ReactElement | null {
  const [locale, setLocale] = useState('en');
  const copy = getCopy(locale);

  const [visible, setVisible] = useState(false);
  const [hasDecision, setHasDecision] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setLocale(readLocaleClient());
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
          aria-label={copy.customize}
          className="bb-chrome-reopen hover:bg-[var(--bb-tint-gold-08)]"
        >
          {copy.customize}
        </button>
        {modalOpen && (
          <ConsentModal
            locale={locale}
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
        aria-label={copy.heading}
        data-testid="cookie-banner"
        className="bb-chrome-banner"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{copy.heading}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {copy.body}{' '}
              <a
                href={copy.privacyLinkHref}
                className="underline decoration-[var(--bb-tint-gold-24)] underline-offset-4 hover:text-[var(--text-primary)]"
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
              className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--bb-border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--bb-tint-gold-08)]"
            >
              {copy.customize}
            </button>
            {/* Reject all: equally prominent as Accept all — no dark pattern */}
            <button
              type="button"
              onClick={handleRejectAll}
              data-testid="cookie-banner-reject-all"
              className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--bb-border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--bb-tint-gold-08)]"
            >
              {copy.rejectAll}
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              data-testid="cookie-banner-accept-all"
              className="min-h-10 rounded-[var(--radius-sm)] bg-[var(--cta)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--cta-hover)]"
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
