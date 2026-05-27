'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

import { useTranslations } from 'next-intl';

import { CloseIcon } from '@/icons';

export const FALLBACK_LOCALE = 'pl-PL' as const;
export const THRESHOLD_LOW = 0.8;
export const THRESHOLD_HIGH = 0.85;
export const LOCALE_FALLBACK_NOTICE_STORAGE_KEY = 'gp.locale-fallback-notice';

export type LocaleFallbackTargetLocale = 'pl-PL' | 'en-US' | 'uk-UA' | 'de-DE';
export type LocaleFallbackNoticeState = 'visible' | 'hidden';

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

    const previousState = storedForLocale?.lastState ?? 'hidden';
    const nextState = resolveLocaleFallbackNoticeState(pageCoverage, previousState, threshold);

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

  const className = useMemo(() => {
    const motionClass = reducedMotion ? '' : ' transition-opacity duration-150 ease-out';

    return [
      'flex min-h-[56px] w-full items-center border-l-[3px] border-[var(--bb-border-strong)] bg-[var(--bb-surface-muted)] px-4 py-3 text-primary sm:min-h-[48px] sm:py-2',
      motionClass
    ].join('');
  }, [reducedMotion]);

  if (!hydrated || !isFallbackRequest || dismissed || state === 'hidden') {
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

  const handleDismissKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleDismiss();
  };

  return (
    <section
      aria-live="polite"
      className={className}
      data-locale-fallback-notice
      role="status"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium leading-5 sm:truncate">
          <span className="sr-only">{t('eyebrow')} </span>
          {t(targetLocale)}
        </p>
        <button
          aria-label={t('dismissLabel')}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-gp-xs text-action transition-colors hover:bg-[var(--bb-tint-gold-08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          onClick={handleDismiss}
          onKeyDown={handleDismissKeyDown}
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
