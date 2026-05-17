/**
 * Stripe PaymentElement appearance — RUNTIME CSS variable resolution.
 *
 * Story 1.4 (v1.8.0) — AC2/AC3/AC5. Decision D-V180-ARCH-12 / F-NEW-A5:
 * appearance MUST be resolved CLIENT-side, w momencie inicjalizacji
 * PaymentElement — NIE build-time, NIE server-side render. Build-time
 * resolution czytałaby PROCESS env CSS variables w build context (nie
 * computed styles urządzenia klienta) i wymuszałaby per-market builds
 * (5 buildów = CI complexity inflation). Runtime resolution daje JEDEN
 * JS bundle obsługujący wszystkie markets przez aktywny theme CSS
 * (`public/themes/<market>.css` załadowany synchronicznie w <head>).
 *
 * AC3 — mapowanie 4 tokenów BonBeauty DS → Stripe `appearance.variables`:
 *   --cta         → variables.colorPrimary  (bonbeauty.css semantic alias)
 *   --radius-md   → variables.borderRadius  (src/styles/tokens/radii.css)
 *   --font-display → variables.fontFamily   (bonbeauty.css semantic alias)
 *   --space-2     → variables.spacingUnit   (src/styles/tokens/spacing.css)
 *
 * Uwaga: architektura D7 specyfikowała `--color-brand-primary`, ale token
 * ten nie istnieje w BonBeauty DS. Realny token koloru marki to `--cta`
 * (rgb(144,112,50) = #907032, brand-600). Zmiana odnotowana w Dev Agent
 * Record (review fix H-1) — reconcile do realnego DS, NIE cicha zmiana.
 *
 * AC5 — fail-loud, NIE silent: gdy computed value pusty/whitespace (theme
 * CSS jeszcze niezaładowany w momencie init PaymentElement), używamy
 * udokumentowanych hardcoded BonBeauty DS v2.x defaults — NIGDY pustego
 * stringa do Stripe, NIGDY crash.
 *
 * [Source: specs/releases/v1.8.0/architecture.md#D-V180-ARCH-12 (810-822),
 *  #D7 BonBeauty DS appearance binding (142, 1000)]
 */
import type { Appearance } from '@stripe/stripe-js';

/**
 * BonBeauty DS v2.x defaults — deterministyczny fallback (AC5).
 *
 * Wartości zsynchronizowane z realnymi tokenami DS (fix M-2):
 *   colorPrimary  = #907032 (=`--cta` = brand-600, 4.62:1 AA vs white)
 *   borderRadius  = 12px    (=`--radius-md` z src/styles/tokens/radii.css)
 *   fontFamily    = 'Funnel Display' (=`--font-display`) + sans-serif fallback
 *   spacingUnit   = 0.5rem  (=`--space-2` = 8px, z src/styles/tokens/spacing.css)
 *
 * Te wartości są kontraktem fallbacku, NIE placeholderem: jeśli theme CSS
 * jest gotowy, computed values nadpisują je per token niezależnie.
 */
export const BONBEAUTY_APPEARANCE_FALLBACK = {
  colorPrimary: '#907032',
  borderRadius: '12px',
  fontFamily: '"Funnel Display", ui-sans-serif, system-ui, sans-serif',
  spacingUnit: '0.5rem'
} as const;

/** Token CSS → klucz Stripe `appearance.variables` (AC3 kontrakt 1:1). */
const TOKEN_MAP = [
  { cssVar: '--cta', variable: 'colorPrimary' },
  { cssVar: '--radius-md', variable: 'borderRadius' },
  { cssVar: '--font-display', variable: 'fontFamily' },
  { cssVar: '--space-2', variable: 'spacingUnit' }
] as const;

type AppearanceVariableKey = (typeof TOKEN_MAP)[number]['variable'];

/**
 * Czyta computed CSS variable z `document.documentElement`. Zwraca trimowaną
 * wartość albo `null` gdy pusta/whitespace (sygnał do fallbacku AC5).
 *
 * `--font-display` w theme jest gołą rodziną (`'Funnel Display'`) — dla
 * Stripe `fontFamily` dokładamy generic sans-serif fallback, żeby uniknąć
 * braku glifów zanim webfont się załaduje (NIE zmienia to tokena, tylko
 * uzupełnia rodzinę zastępczą).
 */
function readToken(cssVar: string, variable: AppearanceVariableKey): string | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
  const value = raw?.trim();
  if (!value) return null;

  if (variable === 'fontFamily' && !/sans-serif|serif|monospace/i.test(value)) {
    return `${value}, ui-sans-serif, system-ui, sans-serif`;
  }
  return value;
}

/**
 * Resolver appearance wywoływany CLIENT-side przy inicjalizacji
 * PaymentElement (AC2). Czyta 4 tokeny BonBeauty DS przez
 * `getComputedStyle` (AC3); brak/pusta wartość → udokumentowany BonBeauty
 * fallback per token (AC5). Zwraca bazę `theme: 'flat'` + dynamiczne
 * `variables` + `rules` override per-input.
 *
 * Guard `typeof document === 'undefined'`: gdyby resolver został wywołany
 * w SSR/build context (anti-pattern F-NEW-A5), zwraca pełny BonBeauty
 * fallback zamiast crashować — runtime klienta i tak nadpisze appearance
 * przy faktycznym montowaniu PaymentElement.
 */
export function getPaymentElementAppearanceRuntime(): Appearance {
  const resolved: Record<AppearanceVariableKey, string> = {
    colorPrimary: BONBEAUTY_APPEARANCE_FALLBACK.colorPrimary,
    borderRadius: BONBEAUTY_APPEARANCE_FALLBACK.borderRadius,
    fontFamily: BONBEAUTY_APPEARANCE_FALLBACK.fontFamily,
    spacingUnit: BONBEAUTY_APPEARANCE_FALLBACK.spacingUnit
  };

  if (typeof document !== 'undefined') {
    for (const { cssVar, variable } of TOKEN_MAP) {
      const value = readToken(cssVar, variable);
      if (value !== null) {
        resolved[variable] = value;
      }
    }
  }

  return {
    theme: 'flat',
    variables: {
      colorPrimary: resolved.colorPrimary,
      borderRadius: resolved.borderRadius,
      fontFamily: resolved.fontFamily,
      spacingUnit: resolved.spacingUnit
    },
    rules: {
      '.Input': {
        border: `1px solid ${resolved.colorPrimary}`,
        borderRadius: resolved.borderRadius,
        padding: resolved.spacingUnit
      },
      '.Input:focus': {
        outline: 'none',
        boxShadow: `0 0 0 1px ${resolved.colorPrimary}`
      },
      '.Label': {
        fontFamily: resolved.fontFamily
      }
    }
  };
}
