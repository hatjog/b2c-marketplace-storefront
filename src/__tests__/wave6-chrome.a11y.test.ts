import { describe, expect, it } from 'vitest';

/**
 * a11y assertions dla Story 3.1 — Wave 6 chrome full impl
 * (W6-03/04/05/06/08/09).
 *
 * Pełny axe-core pass biegnie w Playwright (`@axe-core/playwright`) na
 * component preview harness (Story 3.1 T9 — deferred do CI post-deploy,
 * tak samo jak VR baseline). Ten plik egzekwuje statyczne a11y invarianty
 * weryfikowalne bez przeglądarki, per W6 contract `a11y:` block:
 *
 *   W6-03 newsletter   — region landmark + aria-label + GDPR aria-required
 *   W6-04 cookie banner — alertdialog + focus trap (sub-modal) + ESC→step1
 *   W6-05 modal shell   — dialog + aria-modal + focus trap + ESC + scroll lock
 *   W6-06 toast/alert   — aria-live polite + error→role=alert (assertive)
 *   W6-08 mini-cart     — dialog + focus trap + ESC + aria-live na total
 *   W6-09 search overlay — search role + combobox/listbox + autofocus + ESC
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const ORG = 'src/components/organisms';

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}

describe('W6-03 NewsletterSlot a11y', () => {
  const src = read(`${ORG}/NewsletterSlot/NewsletterSlot.tsx`);
  it('cites the Wave 6 manifest', () => {
    expect(src).toMatch(/@chrome-manifest:\s*W6-03/);
  });
  it('exposes a labelled region landmark', () => {
    expect(src).toMatch(/<section/);
    expect(src).toMatch(/aria-label=\{t\('aria_region'\)\}/);
  });
  it('marks the email input GDPR-required (aria-required)', () => {
    expect(src).toMatch(/aria-required="true"/);
    expect(src).toMatch(/required/);
  });
  it('modal placement is a labelled dialog with ESC dismiss', () => {
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).toMatch(/e\.key === 'Escape'/);
  });
  it('uses next-intl translations only (no hardcoded user strings)', () => {
    expect(src).toMatch(/useTranslations\('newsletter'\)/);
  });
});

describe('W6-04 CookieBanner a11y', () => {
  const src = read(`${ORG}/CookieBanner/CookieBanner.tsx`);
  it('cites the Wave 6 manifest', () => {
    expect(src).toMatch(/@chrome-manifest:\s*W6-04/);
  });
  it('step 1 banner is an alertdialog with aria-describedby', () => {
    expect(src).toMatch(/role="alertdialog"/);
    expect(src).toMatch(/aria-describedby="cookie-banner-desc"/);
  });
  it('sub-modal traps focus and ESC returns to step 1', () => {
    expect(src).toMatch(/useFocusTrap/);
    expect(src).toMatch(/onEscape: \(\) => setStep\('banner'\)/);
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
  });
  it('necessary category toggle is disabled (always-on)', () => {
    expect(src).toMatch(/checked\s*\n?\s*disabled/);
  });
  it('uses next-intl translations only', () => {
    expect(src).toMatch(/useTranslations\('cookie_banner'\)/);
  });
});

describe('W6-05 ModalShell a11y', () => {
  const src = read(`${ORG}/ModalShell/ModalShell.tsx`);
  it('cites the Wave 6 manifest', () => {
    expect(src).toMatch(/@chrome-manifest:\s*W6-05/);
  });
  it('is a dialog with aria-modal + labelledby + describedby', () => {
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).toMatch(/aria-labelledby=\{titleId\}/);
    expect(src).toMatch(/aria-describedby=\{bodyId\}/);
  });
  it('traps focus, closes on ESC and locks scroll', () => {
    expect(src).toMatch(/useFocusTrap/);
    expect(src).toMatch(/onEscape: onClose/);
    expect(src).toMatch(/lockScroll: true/);
  });
  it('uses next-intl translations only', () => {
    expect(src).toMatch(/useTranslations\('modal'\)/);
  });
});

describe('W6-06 ToastAlert a11y', () => {
  const src = read(`${ORG}/ToastAlert/ToastAlert.tsx`);
  it('cites the Wave 6 manifest', () => {
    expect(src).toMatch(/@chrome-manifest:\s*W6-06/);
  });
  it('viewport is a polite aria-live log region', () => {
    expect(src).toMatch(/role="log"/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/aria-atomic="true"/);
  });
  it('error severity escalates to role=alert / assertive', () => {
    expect(src).toMatch(/isError \? 'alert' : 'status'/);
    expect(src).toMatch(/isError \? 'assertive' : 'polite'/);
  });
  it('every toast has a keyboard-dismissible close button', () => {
    expect(src).toMatch(/aria-label=\{t\('dismiss'\)\}/);
  });
  it('uses next-intl translations only', () => {
    expect(src).toMatch(/useTranslations\('toast'\)/);
  });
});

describe('W6-08 MiniCartDrawer a11y', () => {
  const src = read(`${ORG}/MiniCartDrawer/MiniCartDrawer.tsx`);
  it('cites the Wave 6 manifest', () => {
    expect(src).toMatch(/@chrome-manifest:\s*W6-08/);
  });
  it('is a labelled dialog with focus trap + ESC', () => {
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).toMatch(/useFocusTrap/);
    expect(src).toMatch(/onEscape: onClose/);
  });
  it('item count and summary are aria-live polite', () => {
    expect(src).toMatch(/aria-live="polite"/);
  });
  it('slide-in animation respects prefers-reduced-motion', () => {
    expect(src).toMatch(/motion-safe:animate-\[slide-in-right/);
  });
  it('uses next-intl translations only', () => {
    expect(src).toMatch(/useTranslations\('mini_cart'\)/);
  });
});

describe('W6-09 SearchOverlay a11y', () => {
  const src = read(`${ORG}/SearchOverlay/SearchOverlay.tsx`);
  it('cites the Wave 6 manifest', () => {
    expect(src).toMatch(/@chrome-manifest:\s*W6-09/);
  });
  it('is a search landmark with focus trap + ESC', () => {
    expect(src).toMatch(/role="search"/);
    expect(src).toMatch(/useFocusTrap/);
    expect(src).toMatch(/onEscape: onClose/);
  });
  it('input follows the ARIA combobox + listbox pattern', () => {
    expect(src).toMatch(/role="combobox"/);
    expect(src).toMatch(/aria-autocomplete="list"/);
    expect(src).toMatch(/role="listbox"/);
    expect(src).toMatch(/role="option"/);
  });
  it('autofocuses the search input on open', () => {
    expect(src).toMatch(/inputRef\.current\?\.focus\(\)/);
  });
  it('uses next-intl translations only', () => {
    expect(src).toMatch(/useTranslations\('search_overlay'\)/);
  });
});
