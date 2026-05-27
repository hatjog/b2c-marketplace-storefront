// @vitest-environment jsdom

import { act } from 'react';

import { NextIntlClientProvider } from 'next-intl';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '../../../messages/en.json';
import {
  FALLBACK_LOCALE,
  LOCALE_FALLBACK_NOTICE_STORAGE_KEY,
  LocaleFallbackNotice,
  resolveLocaleFallbackNoticeState,
  type LocaleFallbackNoticeProps
} from './LocaleFallbackNotice';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const baseProps: LocaleFallbackNoticeProps = {
  fallbackLocale: FALLBACK_LOCALE,
  pageCoverage: 0.5,
  targetLocale: 'en-US'
};

describe('LocaleFallbackNotice', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let reducedMotion = false;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    reducedMotion = false;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        removeEventListener: vi.fn()
      }))
    });

    window.sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      root = createRoot(container);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderNotice(props: Partial<LocaleFallbackNoticeProps> = {}) {
    await act(async () => {
      root.render(
        <NextIntlClientProvider
          locale="en"
          messages={enMessages}
        >
          <LocaleFallbackNotice
            {...baseProps}
            {...props}
          />
        </NextIntlClientProvider>
      );
    });
  }

  function getStatus(): HTMLElement | null {
    return container.querySelector('[role="status"]');
  }

  it('renders null when coverage is above the upper threshold on first visit', async () => {
    await renderNotice({ pageCoverage: 0.9 });

    expect(getStatus()).toBeNull();
  });

  it('renders banner when coverage is below threshold', async () => {
    await renderNotice({ pageCoverage: 0.5 });

    const status = getStatus();
    expect(status?.textContent).toContain('Translation in progress');
    expect(status?.textContent).toContain('We are still translating this content into English.');
    expect(status?.getAttribute('aria-hidden')).toBeNull();
  });

  it('biases initial render in the hysteresis band to visible (M5 fix)', async () => {
    await renderNotice({ pageCoverage: 0.82 });

    expect(getStatus()).not.toBeNull();
  });

  it('keeps hysteresis state in the threshold band', () => {
    expect(resolveLocaleFallbackNoticeState(0.7, 'hidden')).toBe('visible');
    expect(resolveLocaleFallbackNoticeState(0.82, 'visible')).toBe('visible');
    expect(resolveLocaleFallbackNoticeState(0.86, 'visible')).toBe('hidden');
    expect(resolveLocaleFallbackNoticeState(0.83, 'hidden')).toBe('hidden');
    expect(resolveLocaleFallbackNoticeState(0.79, 'hidden')).toBe('visible');
  });

  it('reserves slot (aria-hidden + opacity-0) after hysteresis hide instead of unmount (H2 zero-CLS)', async () => {
    await renderNotice({ pageCoverage: 0.5 });
    expect(getStatus()).not.toBeNull();

    // hysteresis: coverage rośnie ≥0.85 → state hidden, slot zostaje zarezerwowany
    await renderNotice({ pageCoverage: 0.9 });
    const slot = getStatus();
    expect(slot).not.toBeNull();
    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.className).toContain('opacity-0');
    expect(slot?.className).toContain('pointer-events-none');
  });

  it('dismiss click hides the banner and persists state for the same session locale', async () => {
    await renderNotice({ pageCoverage: 0.5 });

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close translation notice"]'
    );
    expect(button).not.toBeNull();

    await act(async () => {
      button?.click();
    });

    expect(getStatus()).toBeNull();
    expect(window.sessionStorage.getItem(LOCALE_FALLBACK_NOTICE_STORAGE_KEY)).toContain(
      '"dismissed":true'
    );

    await renderNotice({ pageCoverage: 0.5 });
    expect(getStatus()).toBeNull();
  });

  it('allows the banner to return after dismiss when target locale changes', async () => {
    await renderNotice({ pageCoverage: 0.5, targetLocale: 'en-US' });

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close translation notice"]'
    );

    await act(async () => {
      button?.click();
    });

    await renderNotice({ pageCoverage: 0.5, targetLocale: 'de-DE' });

    expect(getStatus()?.textContent).toContain('We are still translating this content');
  });

  it('renders null for canonical fallback locale requests', async () => {
    await renderNotice({ pageCoverage: 0.1, targetLocale: FALLBACK_LOCALE });

    expect(getStatus()).toBeNull();
  });

  it('exposes polite status semantics and localized dismiss label', async () => {
    await renderNotice({ pageCoverage: 0.5 });

    const status = getStatus();
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Close translation notice'
    );
  });

  it('dismisses on native button activation (Enter triggers click on HTMLButtonElement)', async () => {
    await renderNotice({ pageCoverage: 0.5 });

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close translation notice"]'
    );

    // Native button activation: Enter on focused button → click. jsdom nie
    // synthesizuje click z keydown, więc testujemy aktywację bezpośrednio przez
    // .click() — semantycznie ekwiwalentnie do Enter/Space na buttonie.
    await act(async () => {
      button?.click();
    });

    expect(getStatus()).toBeNull();
  });

  it('does not include transition class when reduced motion is preferred', async () => {
    reducedMotion = true;

    await renderNotice({ pageCoverage: 0.5 });

    expect(getStatus()?.className).not.toContain('transition-opacity');
  });
});
