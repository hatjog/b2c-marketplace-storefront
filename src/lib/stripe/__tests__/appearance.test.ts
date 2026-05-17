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

/**
 * Wyciąga deklaracje `--token: value;` ze WSZYSTKICH bloków `:root` w pliku CSS.
 * M-1 fix: poprzednia wersja używała `match()` (tylko pierwszy blok) — bonbeauty.css
 * ma DWA bloki `:root` (paleta + tokeny semantyczne); `matchAll` z flagą `g` ładuje oba.
 */
function loadCssVars(filePath: string): Record<string, string> {
  const css = readFileSync(filePath, 'utf8');
  const vars: Record<string, string> = {};
  for (const rootBlock of css.matchAll(/:root\s*\{([\s\S]*?)\}/g)) {
    for (const decl of rootBlock[1].split(';')) {
      const m = decl.match(/\s*(--[\w-]+)\s*:\s*([^;]+)/);
      if (m) vars[m[1]] = m[2].trim();
    }
  }
  return vars;
}

/** Ładuje plik theme z public/themes/<name>. */
function loadThemeVars(themeFile: string): Record<string, string> {
  return loadCssVars(path.resolve(__dirname, '../../../../public/themes', themeFile));
}

/** Ładuje plik tokenów z src/styles/tokens/<name>. */
function loadTokenVars(tokenFile: string): Record<string, string> {
  return loadCssVars(path.resolve(__dirname, '../../../styles/tokens', tokenFile));
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
    // H-1 fix: --color-brand-primary nie istnieje w DS; realny token to --cta.
    setRootVars({
      '--cta': '#123456',
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
  it('BonBeauty theme (active gate v1.8.0): wszystkie 4 tokeny resolved z warstw DS', () => {
    // M-1 fix: załaduj wszystkie warstwy CSS aktywne w produkcyjnym DOM —
    // nie tylko plik theme, ale też globalne tokeny z globals.css chain.
    // Kolejność: ogólne tokeny (radii, spacing) + override theme (bonbeauty).
    setRootVars(loadTokenVars('radii.css'));
    setRootVars(loadTokenVars('spacing.css'));
    setRootVars(loadThemeVars('bonbeauty.css'));

    const appearance = getPaymentElementAppearanceRuntime();

    // Wszystkie 4 tokeny resolved z rzeczywistych warstw DS:
    //   --cta         → colorPrimary  (bonbeauty.css semantic token)
    //   --radius-md   → borderRadius  (radii.css: 12px)
    //   --font-display → fontFamily   (bonbeauty.css: 'Funnel Display')
    //   --space-2     → spacingUnit   (spacing.css: 0.5rem)
    expect(appearance.variables?.colorPrimary).toBe('rgb(144, 112, 50)');
    expect(appearance.variables?.borderRadius).toBe('12px');
    expect(appearance.variables?.fontFamily).toContain('Funnel Display');
    expect(appearance.variables?.spacingUnit).toBe('0.5rem');
    // AC5 anti-pattern: żadne zmienne nie są pustym stringiem.
    for (const v of Object.values(appearance.variables ?? {})) {
      expect(String(v).trim()).not.toBe('');
    }
    // Pełny snapshot jako kontrakt regresji.
    expect(appearance).toMatchInlineSnapshot(`
      {
        "rules": {
          ".Input": {
            "border": "1px solid rgb(144, 112, 50)",
            "borderRadius": "12px",
            "padding": "0.5rem",
          },
          ".Input:focus": {
            "boxShadow": "0 0 0 1px rgb(144, 112, 50)",
            "outline": "none",
          },
          ".Label": {
            "fontFamily": "'Funnel Display', ui-sans-serif, system-ui, sans-serif",
          },
        },
        "theme": "flat",
        "variables": {
          "borderRadius": "12px",
          "colorPrimary": "rgb(144, 112, 50)",
          "fontFamily": "'Funnel Display', ui-sans-serif, system-ui, sans-serif",
          "spacingUnit": "0.5rem",
        },
      }
    `);
  });
});
