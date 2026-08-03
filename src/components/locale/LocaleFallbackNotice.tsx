'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';

import { CloseIcon } from '@/icons';

export const FALLBACK_LOCALE = 'pl-PL' as const;
export const THRESHOLD_LOW = 0.8;
export const THRESHOLD_HIGH = 0.85;
export const LOCALE_FALLBACK_NOTICE_STORAGE_KEY = 'gp.locale-fallback-notice';

export type LocaleFallbackTargetLocale = 'pl-PL' | 'en-US' | 'uk-UA' | 'de-DE';
export type LocaleFallbackNoticeState = 'visible' | 'hidden';

/**
 * Banner page-level dla fallbacku locale (non-PL route z niskim coverage).
 *
 * Kontrakt konsumenta (NFR5.4 — `<html lang>` integrity dla fallback fragments):
 * fragment treści, który faktycznie pochodzi z PL fallback messages, MUSI być
 * opakowany przez konsumenta w `<div lang="pl">` aby screenreader poprawnie
 * przełączył pronunciation. Sam banner używa user-locale tekstu (route locale).
 *
 * Hysteresis (anti-flicker):
 * - coverage ≤ THRESHOLD_LOW (0.80) → `visible`
 * - coverage ≥ THRESHOLD_HIGH (0.85) → `hidden`
 * - 0.80 < coverage < 0.85 → zachowaj poprzedni stan (z sessionStorage; default
 *   po pierwszym wejściu = `visible`, bias do show per Trust Invariant #7).
 *
 * Zero CLS przy hide/show: po pierwszej widoczności w sesji slot rezerwuje
 * wysokość (48/56 px) i toggluje `aria-hidden` + opacity zamiast unmountu.
 */
export interface LocaleFallbackNoticeProps {
  pageCoverage: number;
  targetLocale: LocaleFallbackTargetLocale;
  fallbackLocale: typeof FALLBACK_LOCALE;
  threshold?: number;
}

interface StoredLocaleFallbackNoticeState {
  targetLocale: LocaleFallbackTargetLocale;
  lastState: LocaleFallbackNoticeState;
  dismissed: boolean;
}

type StoredLocaleFallbackNotice = Partial<
  Record<LocaleFallbackTargetLocale, StoredLocaleFallbackNoticeState>
>;

export function resolveLocaleFallbackNoticeState(
  pageCoverage: number,
  previousState: LocaleFallbackNoticeState,
  threshold = THRESHOLD_LOW
): LocaleFallbackNoticeState {
  if (pageCoverage <= threshold) {
    return 'visible';
  }

  if (pageCoverage >= THRESHOLD_HIGH) {
    return 'hidden';
  }

  return previousState;
}

function readStoredNotice(): StoredLocaleFallbackNotice {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(LOCALE_FALLBACK_NOTICE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return parsed as StoredLocaleFallbackNotice;
  } catch {
    return {};
  }
}

function writeStoredNotice(nextState: StoredLocaleFallbackNotice): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(LOCALE_FALLBACK_NOTICE_STORAGE_KEY, JSON.stringify(nextState));
}

export function LocaleFallbackNotice({
  pageCoverage,
  targetLocale,
  fallbackLocale,
  threshold = THRESHOLD_LOW
}: LocaleFallbackNoticeProps) {
  const t = useTranslations('banner.workingOnIt');
  const [state, setState] = useState<LocaleFallbackNoticeState>('hidden');
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const hasBeenVisibleRef = useRef(false);

  const isFallbackRequest = targetLocale !== fallbackLocale;

  useEffect(() => {
    setHydrated(true);

    if (!isFallbackRequest) {
      setState('hidden');
      setDismissed(false);
      return;
    }

    const stored = readStoredNotice();
    const storedForLocale = stored[targetLocale];

    if (storedForLocale?.dismissed) {
      setDismissed(true);
      setState('hidden');
      return;
    }

    // M5 fix: bias do `visible` przy pierwszym wejściu w bandzie 0.80-0.85,
    // żeby uczciwie ostrzec o fallbacku zamiast chować notice przy braku kontekstu.
    const previousState = storedForLocale?.lastState ?? 'visible';
    const nextState = resolveLocaleFallbackNoticeState(pageCoverage, previousState, threshold);

    if (storedForLocale?.lastState === 'visible' || nextState === 'visible') {
      hasBeenVisibleRef.current = true;
    }

    setDismissed(false);
    setState(nextState);
    writeStoredNotice({
      ...stored,
      [targetLocale]: {
        targetLocale,
        lastState: nextState,
        dismissed: false
      }
    });
  }, [fallbackLocale, isFallbackRequest, pageCoverage, targetLocale, threshold]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  const isHidden = state === 'hidden' || dismissed;

  const className = useMemo(() => {
    const motionClass = reducedMotion ? '' : ' transition-opacity duration-150 ease-out';
    const visibilityClass = isHidden ? ' opacity-0 pointer-events-none' : '';

    return [
      'flex min-h-[56px] w-full items-center border-l-[3px] border-[var(--bb-border-strong)] bg-[var(--bb-surface-muted)] px-4 py-3 text-primary sm:min-h-[48px] sm:py-2',
      motionClass,
      visibilityClass
    ].join('');
  }, [reducedMotion, isHidden]);

  if (!hydrated || !isFallbackRequest) {
    return null;
  }

  // H2 fix: po pierwszej widoczności w sesji renderuj slot z rezerwacją wysokości
  // (aria-hidden + opacity-0) zamiast unmountu — eliminuje CLS przy hysteresis
  // toggling visible↔hidden. Dismiss permanentnie unmountuje (brak slotu).
  if (dismissed || (isHidden && !hasBeenVisibleRef.current)) {
    return null;
  }

  const handleDismiss = () => {
    const stored = readStoredNotice();
    writeStoredNotice({
      ...stored,
      [targetLocale]: {
        targetLocale,
        lastState: 'hidden',
        dismissed: true
      }
    });
    setDismissed(true);
    setState('hidden');
  };

  return (
    <section
      aria-hidden={isHidden ? true : undefined}
      aria-live="polite"
      className={className}
      data-locale-fallback-notice
      role="status"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium leading-5 sm:truncate">
          <span className="block text-xs font-semibold uppercase tracking-wide opacity-70">
            {t('eyebrow')}
          </span>
          {t('message')}
        </p>
        <button
          aria-label={t('dismissLabel')}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-gp-xs text-action transition-colors hover:bg-[var(--bb-tint-gold-08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          onClick={handleDismiss}
          tabIndex={isHidden ? -1 : 0}
          type="button"
        >
          <CloseIcon
            color="currentColor"
            size={24}
          />
        </button>
      </div>
    </section>
  );
}
