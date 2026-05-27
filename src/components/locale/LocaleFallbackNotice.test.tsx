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

  it('renders null when coverage is above the upper threshold', async () => {
    await renderNotice({ pageCoverage: 0.9 });

    expect(getStatus()).toBeNull();
  });

  it('renders banner when coverage is below threshold', async () => {
    await renderNotice({ pageCoverage: 0.5 });

    expect(getStatus()?.textContent).toContain('English');
  });

  it('keeps hysteresis state in the threshold band', () => {
    expect(resolveLocaleFallbackNoticeState(0.7, 'hidden')).toBe('visible');
    expect(resolveLocaleFallbackNoticeState(0.82, 'visible')).toBe('visible');
    expect(resolveLocaleFallbackNoticeState(0.86, 'visible')).toBe('hidden');
    expect(resolveLocaleFallbackNoticeState(0.83, 'hidden')).toBe('hidden');
    expect(resolveLocaleFallbackNoticeState(0.79, 'hidden')).toBe('visible');
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

    expect(getStatus()?.textContent).toContain('German');
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

  it('dismisses on Enter key', async () => {
    await renderNotice({ pageCoverage: 0.5 });

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close translation notice"]'
    );

    await act(async () => {
      button?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });

    expect(getStatus()).toBeNull();
  });

  it('does not include transition class when reduced motion is preferred', async () => {
    reducedMotion = true;

    await renderNotice({ pageCoverage: 0.5 });

    expect(getStatus()?.className).not.toContain('transition-opacity');
  });
});
