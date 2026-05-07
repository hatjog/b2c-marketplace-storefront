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

import { getConsent, setConsent } from '@/lib/consent';
import { clearPreferencesStorage } from '@/lib/consent';

// ---------------------------------------------------------------------------
// Modal copy
// ---------------------------------------------------------------------------

interface ModalCopy {
  heading: string;
  saveBtn: string;
  necessary: { label: string; desc: string };
  preferences: { label: string; desc: string };
  analytics: { label: string; desc: string };
  marketing: { label: string; desc: string };
  alwaysActive: string;
}

const MODAL_COPY: Record<string, ModalCopy> = {
  pl: {
    heading: 'Dostosuj ustawienia cookie',
    saveBtn: 'Zapisz wybór',
    alwaysActive: 'Zawsze aktywne',
    necessary: {
      label: 'Niezbędne',
      desc: 'Wymagane do prawidłowego działania strony: sesja, język, token bezpieczeństwa (CSRF). Podstawa prawna: uzasadniony interes.'
    },
    preferences: {
      label: 'Preferencje',
      desc: 'Zapamiętywanie Twoich wyborów UX: stan pauzy vouchera, stan kreatora MoR, geolokalizacja. Podstawa prawna: zgoda.'
    },
    analytics: {
      label: 'Analityka',
      desc: 'Dane o korzystaniu ze strony (PostHog). Pomagają nam udoskonalać produkt. Podstawa prawna: zgoda.'
    },
    marketing: {
      label: 'Marketing',
      desc: 'Personalizacja reklam i śledzenie konwersji. Zarezerwowane dla przyszłych partnerów reklamowych. Podstawa prawna: zgoda.'
    }
  },
  en: {
    heading: 'Customise cookie settings',
    saveBtn: 'Save preferences',
    alwaysActive: 'Always active',
    necessary: {
      label: 'Necessary',
      desc: 'Required for the site to work: session, language, security token (CSRF). Legal basis: legitimate interest.'
    },
    preferences: {
      label: 'Preferences',
      desc: 'Remember your UX choices: voucher pause state, MoR wizard state, geolocation cache. Legal basis: consent.'
    },
    analytics: {
      label: 'Analytics',
      desc: 'Site usage data (PostHog). Helps us improve the product. Legal basis: consent.'
    },
    marketing: {
      label: 'Marketing',
      desc: 'Personalised ads and conversion tracking. Reserved for future ad partners. Legal basis: consent.'
    }
  },
  ua: {
    heading: 'Налаштування cookie',
    saveBtn: 'Зберегти вибір',
    alwaysActive: 'Завжди активні',
    necessary: {
      label: 'Необхідні',
      desc: 'Необхідні для роботи сайту: сесія, мова, токен безпеки (CSRF). Правова підстава: законний інтерес.'
    },
    preferences: {
      label: 'Налаштування',
      desc: "Запам’ятовування вибору UX: стан паузи ваучера, стан майстра MoR, геолокація. Правова підстава: згода."
    },
    analytics: {
      label: 'Аналітика',
      desc: 'Дані про використання сайту (PostHog). Допомагає нам удосконалювати продукт. Правова підстава: згода.'
    },
    marketing: {
      label: 'Маркетинг',
      desc: 'Персоналізована реклама та відстеження конверсій. Зарезервовано для майбутніх рекламних партнерів. Правова підстава: згода.'
    }
  },
  de: {
    heading: 'Cookie-Einstellungen anpassen',
    saveBtn: 'Auswahl speichern',
    alwaysActive: 'Immer aktiv',
    necessary: {
      label: 'Notwendig',
      desc: 'Für den Betrieb der Website erforderlich: Sitzung, Sprache, Sicherheitstoken (CSRF). Rechtsgrundlage: berechtigtes Interesse.'
    },
    preferences: {
      label: 'Einstellungen',
      desc: 'Speichern Ihrer UX-Auswahl: Voucher-Pausenstatus, MoR-Assistentenstatus, Geolokalisierungscache. Rechtsgrundlage: Einwilligung.'
    },
    analytics: {
      label: 'Analyse',
      desc: 'Nutzungsdaten der Website (PostHog). Hilft uns, das Produkt zu verbessern. Rechtsgrundlage: Einwilligung.'
    },
    marketing: {
      label: 'Marketing',
      desc: 'Personalisierte Werbung und Conversion-Tracking. Reserviert für zukünftige Werbepartner. Rechtsgrundlage: Einwilligung.'
    }
  }
};

function getCopy(locale: string): ModalCopy {
  return MODAL_COPY[locale] ?? MODAL_COPY['en'];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ConsentModalProps {
  locale: string;
  onClose: () => void;
}

export function ConsentModal({ locale, onClose }: ConsentModalProps): ReactElement {
  const copy = getCopy(locale);
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
      } catch {
        /* showModal can throw if already open — non-fatal */
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
      aria-label={copy.heading}
      data-testid="consent-modal"
      onKeyDown={handleKeyDown}
      className="m-auto max-w-lg rounded-md bg-primary p-6 shadow-xl backdrop:bg-tertiary/60"
    >
      <h2 className="heading-md mb-4 text-secondary">{copy.heading}</h2>

      <div className="flex flex-col gap-4">
        {/* Necessary — always active, no toggle */}
        <div className="flex items-start justify-between gap-4 rounded-sm border border-tertiary/20 p-3">
          <div>
            <p className="text-sm font-semibold text-secondary">{copy.necessary.label}</p>
            <p className="mt-1 text-xs text-tertiary">{copy.necessary.desc}</p>
          </div>
          <span
            className="shrink-0 rounded-full bg-action/10 px-2 py-1 text-xs font-medium text-action"
            aria-label={copy.alwaysActive}
          >
            {copy.alwaysActive}
          </span>
        </div>

        {/* Preferences */}
        <CategoryToggle
          label={copy.preferences.label}
          desc={copy.preferences.desc}
          checked={preferences}
          id="cmp-preferences"
          onChange={setPreferences}
        />

        {/* Analytics */}
        <CategoryToggle
          label={copy.analytics.label}
          desc={copy.analytics.desc}
          checked={analytics}
          id="cmp-analytics"
          onChange={setAnalytics}
        />

        {/* Marketing */}
        <CategoryToggle
          label={copy.marketing.label}
          desc={copy.marketing.desc}
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
          {copy.saveBtn}
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
