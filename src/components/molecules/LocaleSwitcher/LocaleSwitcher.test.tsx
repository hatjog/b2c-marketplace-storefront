// @vitest-environment jsdom
// @chrome-manifest: W6-10
//
// W6-10 LocaleSwitcher functional audit (Story 7.7 AC5 + AC6).
// Verifies the contract from specs/design-system/bonbeauty/components/locale-switcher.yaml:
//   - native names + country codes per locale (PL/EN/UA/DE)
//   - aria-expanded toggle, aria-haspopup, role="listbox", role="option"
//   - aria-selected on current locale
//   - prefix swap preserves the rest of the URL path (F-NEW-D2 strategy)
//   - clicking the same locale closes the dropdown without router.push
//   - non-locale leading segments get a locale prefix prepended (preserve path)
//
// Note: this is a contract/behavior test, not a runtime visual smoke. Visual
// regression coverage per locale lives in GP/e2e and is out of scope for this
// test file.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const pushMock = vi.fn();
const refreshMock = vi.fn();
const pathnameMock = vi.fn<() => string>();

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

import { LocaleSwitcher } from './LocaleSwitcher';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

describe('LocaleSwitcher (W6-10 chrome manifest)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    pushMock.mockReset();
    refreshMock.mockReset();
    pathnameMock.mockReset();
    pathnameMock.mockReturnValue('/pl/products/serum-retinol-bakuchiol');

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
  });

  async function renderWith(currentLocale: string) {
    await act(async () => {
      root.render(<LocaleSwitcher currentLocale={currentLocale} />);
    });
  }

  function getToggle(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('[data-testid="locale-switcher"] > button');
    if (!button) {
      throw new Error('toggle button missing');
    }
    return button;
  }

  function getListbox(): HTMLDivElement | null {
    return container.querySelector<HTMLDivElement>('[role="listbox"]');
  }

  it('renders closed pill with current locale flag and country code (W6-10 contract)', async () => {
    await renderWith('pl');
    const toggle = getToggle();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-haspopup')).toBe('listbox');
    expect(toggle.getAttribute('aria-label')).toBe('Język: Polski');
    expect(toggle.textContent).toContain('PL');
    expect(getListbox()).toBeNull();
  });

  it('opens listbox with all 4 locales + native names on click (PL/EN/UA/DE)', async () => {
    await renderWith('en');
    const toggle = getToggle();

    await act(async () => {
      toggle.click();
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const listbox = getListbox();
    expect(listbox).not.toBeNull();
    expect(listbox?.getAttribute('aria-label')).toBe('Wybierz język');

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    expect(options).toHaveLength(4);
    const names = options.map((opt) => opt.textContent ?? '');
    expect(names.some((t) => t.includes('Polski'))).toBe(true);
    expect(names.some((t) => t.includes('English'))).toBe(true);
    expect(names.some((t) => t.includes('Українська'))).toBe(true);
    expect(names.some((t) => t.includes('Deutsch'))).toBe(true);
  });

  it('marks current locale with aria-selected=true and others with aria-selected=false', async () => {
    await renderWith('ua');
    await act(async () => {
      getToggle().click();
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const selected = options.filter((opt) => opt.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]?.textContent).toContain('Українська');
  });

  it('swaps locale prefix and preserves the rest of the path (F-NEW-D2 Product PDP)', async () => {
    pathnameMock.mockReturnValue('/pl/products/serum-retinol-bakuchiol');
    await renderWith('pl');
    await act(async () => {
      getToggle().click();
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const enOption = options.find((opt) => opt.textContent?.includes('English'));
    expect(enOption).toBeDefined();

    await act(async () => {
      enOption?.click();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/en/products/serum-retinol-bakuchiol');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('does not call router.push when clicking the already-selected locale', async () => {
    pathnameMock.mockReturnValue('/de/account');
    await renderWith('de');
    await act(async () => {
      getToggle().click();
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const deOption = options.find((opt) => opt.textContent?.includes('Deutsch'));
    expect(deOption).toBeDefined();

    await act(async () => {
      deOption?.click();
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    // dropdown closed after click
    expect(getListbox()).toBeNull();
  });

  it('prepends locale prefix when pathname has no current locale segment', async () => {
    pathnameMock.mockReturnValue('/static-asset');
    await renderWith('pl');
    await act(async () => {
      getToggle().click();
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const uaOption = options.find((opt) => opt.textContent?.includes('Українська'));
    await act(async () => {
      uaOption?.click();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/ua/static-asset');
  });

  it('handles UA route slug stable across locales (F-NEW-D2 Voucher recipient)', async () => {
    pathnameMock.mockReturnValue('/ua/voucher/abc123def');
    await renderWith('ua');
    await act(async () => {
      getToggle().click();
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const deOption = options.find((opt) => opt.textContent?.includes('Deutsch'));
    await act(async () => {
      deOption?.click();
    });

    expect(pushMock).toHaveBeenCalledWith('/de/voucher/abc123def');
  });
});
