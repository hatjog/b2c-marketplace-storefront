import { describe, expect, it } from 'vitest';

/**
 * a11y assertions for STORY-2-1 voucher PII consent moment.
 *
 * The full axe-core pass runs in Playwright E2E (`@axe-core/playwright`,
 * see `GP/e2e/tests/voucher-consent-flow.spec.ts`). This file enforces the
 * static a11y invariants we can prove without a browser:
 *
 *   AC-VPII-2.1-01 — `<dialog>` carries role/aria-modal/aria-describedby
 *   AC-A11Y-RECIPIENT-01 — checkbox aria-label uses semantic key
 *   NFR-A11Y-5 — grant + skip + withdraw CTAs share min-h-12 / min-w-12
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}

describe('ConsentMomentInline a11y attributes', () => {
  const source = read('src/components/molecules/ConsentMomentInline/ConsentMomentInline.tsx');

  it('sets role="dialog" on the <dialog> element', () => {
    expect(source).toMatch(/role="dialog"/);
  });

  it('sets aria-modal="true"', () => {
    expect(source).toMatch(/aria-modal="true"/);
  });

  it('links aria-describedby to the consent purpose paragraph', () => {
    expect(source).toMatch(/aria-describedby=\{purposeId\}/);
  });

  it('checkbox is NOT pre-checked (Art. 7 GDPR / CJEU Planet49)', () => {
    expect(source).not.toMatch(/checked={true}/);
    expect(source).not.toMatch(/defaultChecked/);
    expect(source).toMatch(/checked=\{consentChecked\}/);
  });

  it('grant CTA disabled until checkbox checked', () => {
    expect(source).toMatch(/disabled=\{!consentChecked \|\| pending\}/);
  });

  it('uses next-intl translations only (no hardcoded user-visible strings)', () => {
    expect(source).toMatch(/useTranslations\('voucher\.consent'\)/);
  });
});

describe('ConsentMomentInline NFR-A11Y-5 visual parity (CTA tap targets)', () => {
  const source = read('src/components/molecules/ConsentMomentInline/ConsentMomentInline.tsx');

  it('grant CTA has min-h-12 + min-w-12', () => {
    const grantBlock = source.split('consent-grant-cta')[1] ?? '';
    expect(grantBlock).toMatch(/min-h-12/);
    expect(grantBlock).toMatch(/min-w-12/);
  });

  it('skip CTA has matching min-h-12 + min-w-12 (UX-DR23 ±10%)', () => {
    const skipBlock = source.split('consent-skip-cta')[1]?.split('</button>')[0] ?? '';
    expect(skipBlock).toMatch(/min-h-12/);
    expect(skipBlock).toMatch(/min-w-12/);
  });
});

describe('Voucher consent route NFR-SEC-5/6 + Referrer-Policy', () => {
  const source = read('src/app/[locale]/voucher/consent/[token]/page.tsx');

  it('sets Referrer-Policy: no-referrer in metadata', () => {
    expect(source).toMatch(/'Referrer-Policy': 'no-referrer'/);
  });

  it('disables search indexing on consent route', () => {
    expect(source).toMatch(/index: false/);
  });

  it('renders <noscript> form for AC-VPII-2.1-02 no-JS fallback', () => {
    expect(source).toMatch(/<noscript>/);
  });
});

describe('RecipientPausePathToggle aria region label', () => {
  const source = read(
    'src/components/molecules/RecipientPausePathToggle/RecipientPausePathToggle.tsx'
  );

  it('has aria-label sourced from translations', () => {
    expect(source).toMatch(/aria-label=\{t\('region_aria'\)\}/);
  });

  it('every CTA has min-h-12 + min-w-12 tap target', () => {
    const ctas = source.match(/<button[\s\S]*?<\/button>/g) ?? [];
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta).toMatch(/min-h-12/);
      expect(cta).toMatch(/min-w-12/);
    }
  });
});
