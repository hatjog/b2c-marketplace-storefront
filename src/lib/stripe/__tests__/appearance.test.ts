/**
 * @vitest-environment jsdom
 *
 * Story 1.4 — appearance.ts runtime resolver.
 *
 * Pokrywa: AC3 (mapowanie 4 tokenów → Stripe variables), AC5 (fail-loud
 * fallback gdy computed value pusty/whitespace), AC8 (snapshot per market
 * theme — setup ładuje `public/themes/bonbeauty.css` przed snapshotem).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BONBEAUTY_APPEARANCE_FALLBACK, getPaymentElementAppearanceRuntime } from '../appearance';

/** Wyciąga deklaracje `--token: value;` z bloku `:root` pliku theme. */
function loadThemeRootVars(themeFile: string): Record<string, string> {
  const css = readFileSync(path.resolve(__dirname, '../../../../public/themes', themeFile), 'utf8');
  const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
  const vars: Record<string, string> = {};
  if (rootBlock) {
    for (const decl of rootBlock[1].split(';')) {
      const m = decl.match(/\s*(--[\w-]+)\s*:\s*([^;]+)/);
      if (m) vars[m[1]] = m[2].trim();
    }
  }
  return vars;
}

function setRootVars(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v);
  }
}

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('getPaymentElementAppearanceRuntime — AC3 token mapping', () => {
  it('maps all 4 BonBeauty DS tokens to Stripe appearance.variables', () => {
    setRootVars({
      '--color-brand-primary': '#123456',
      '--radius-md': '12px',
      '--font-display': 'Custom Display',
      '--space-2': '6px'
    });

    const appearance = getPaymentElementAppearanceRuntime();

    expect(appearance.theme).toBe('flat');
    expect(appearance.variables?.colorPrimary).toBe('#123456');
    expect(appearance.variables?.borderRadius).toBe('12px');
    // fontFamily bez generic family → resolver dokłada sans-serif fallback.
    expect(appearance.variables?.fontFamily).toBe(
      'Custom Display, ui-sans-serif, system-ui, sans-serif'
    );
    expect(appearance.variables?.spacingUnit).toBe('6px');
    // rules override per-input (AC3).
    expect(appearance.rules?.['.Input']).toMatchObject({
      borderRadius: '12px',
      padding: '6px'
    });
  });

  it('keeps explicit generic font family untouched', () => {
    setRootVars({ '--font-display': 'Inter, sans-serif' });
    const appearance = getPaymentElementAppearanceRuntime();
    expect(appearance.variables?.fontFamily).toBe('Inter, sans-serif');
  });
});

describe('getPaymentElementAppearanceRuntime — AC5 fail-loud fallback', () => {
  it('uses documented BonBeauty defaults when NO token present', () => {
    const appearance = getPaymentElementAppearanceRuntime();
    expect(appearance.variables).toEqual({
      colorPrimary: BONBEAUTY_APPEARANCE_FALLBACK.colorPrimary,
      borderRadius: BONBEAUTY_APPEARANCE_FALLBACK.borderRadius,
      fontFamily: BONBEAUTY_APPEARANCE_FALLBACK.fontFamily,
      spacingUnit: BONBEAUTY_APPEARANCE_FALLBACK.spacingUnit
    });
  });

  it('falls back per-token on empty/whitespace computed value (never empty string)', () => {
    setRootVars({
      '--color-brand-primary': '   ',
      '--radius-md': '',
      '--font-display': 'Themed Font',
      '--space-2': '\t'
    });

    const appearance = getPaymentElementAppearanceRuntime();

    expect(appearance.variables?.colorPrimary).toBe(BONBEAUTY_APPEARANCE_FALLBACK.colorPrimary);
    expect(appearance.variables?.borderRadius).toBe(BONBEAUTY_APPEARANCE_FALLBACK.borderRadius);
    expect(appearance.variables?.spacingUnit).toBe(BONBEAUTY_APPEARANCE_FALLBACK.spacingUnit);
    // present token still resolved (+ sans-serif fallback appended)
    expect(appearance.variables?.fontFamily).toBe(
      'Themed Font, ui-sans-serif, system-ui, sans-serif'
    );
    // AC5 anti-pattern guard: zero empty strings passed to Stripe.
    for (const v of Object.values(appearance.variables ?? {})) {
      expect(String(v).trim()).not.toBe('');
    }
  });
});

describe('getPaymentElementAppearanceRuntime — AC8 snapshot per market theme', () => {
  it('BonBeauty theme (active gate v1.8.0): font from theme, rest fallback', () => {
    setRootVars(loadThemeRootVars('bonbeauty.css'));

    const appearance = getPaymentElementAppearanceRuntime();

    // bonbeauty.css definiuje --font-display ('Funnel Display'), NIE definiuje
    // pozostałych 3 tokenów → AC5 fallback gałąź dla nich (deterministyczne).
    expect(appearance).toMatchInlineSnapshot(`
      {
        "rules": {
          ".Input": {
            "border": "1px solid #907032",
            "borderRadius": "8px",
            "padding": "4px",
          },
          ".Input:focus": {
            "boxShadow": "0 0 0 1px #907032",
            "outline": "none",
          },
          ".Label": {
            "fontFamily": ""Funnel Display", ui-sans-serif, system-ui, sans-serif",
          },
        },
        "theme": "flat",
        "variables": {
          "borderRadius": "8px",
          "colorPrimary": "#907032",
          "fontFamily": ""Funnel Display", ui-sans-serif, system-ui, sans-serif",
          "spacingUnit": "4px",
        },
      }
    `);
  });
});
