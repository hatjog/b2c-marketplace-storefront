/**
 * Staging quality-gate'u treści — Story 1.4 v1.14.0 (FR-1, HG-5/HG-6; AD-4, ADR-164).
 *
 * JEDYNE miejsce, w którym storefront rozstrzyga, KTÓRY slug mapy
 * `metadata.gp.content_bar` jest podstawą decyzji `checkQualityGate`:
 *
 *   FAZA 1 (domyślna)      → `content_bar.pl`  — listing w każdym locale
 *                            pokazuje pełny katalog, z treścią fallback PL
 *                            tam, gdzie tłumaczenia jeszcze nie ma;
 *   FAZA 2 (`<locale>`)    → `content_bar[<locale>]` — dopiero po green HG-6
 *                            dla tego locale.
 *
 * Przełącznik jest jawną flagą per-locale w runtime config marketu
 * (`content_gate.phase_2_locales` w `market-runtime-config.v1.schema.json`).
 * Flip = krok release-checklisty (AD-15), nigdy automat: żaden kod tutaj nie
 * „wykrywa" gotowości locale i nie promuje go sam.
 *
 * Progi 80/40 NIE żyją w storefroncie i nie wolno ich tu importować ani
 * przepisywać — kanoniczna stała `CONTENT_BAR_THRESHOLDS` mieszka w
 * `GP/backend/packages/api/src/scripts/lib/content-bar.ts` i liczy `bar`
 * w sync-time (AD-4). Storefront czyta wyłącznie gotowe pole `bar`.
 */
import 'server-only';

import * as Sentry from '@sentry/nextjs';

import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from '@/i18n/routing';
import { PHASE_1_GATE_SLUG } from '@/lib/content-gate-constants';
import { readRuntimeMarketConfig } from '@/lib/runtime-market-config';

/**
 * Slug baru używany w FAZIE 1 dla KAŻDEGO locale requestu. To jest ta jedna
 * liczba stopni swobody, dzięki której reland PDP (1.3) nie zeruje katalogu
 * na `/ua` `/de` `/en` przed shipem treści (ryzyko E-3).
 *
 * Definicja żyje w `content-gate-constants.ts` (bez `server-only`; review
 * 1-4-F8) — re-eksport zachowuje dotychczasowy punkt importu.
 */
export { PHASE_1_GATE_SLUG };

// Key set of `properties.content_gate` in market-runtime-config.v1.schema.json.
// Drift-tested against the schema (AC3 allowed-keys == schema-properties parity).
export const CONTENT_GATE_SCHEMA_KEYS = ['phase_2_locales'] as const;
export type ContentGateSchemaKey = (typeof CONTENT_GATE_SCHEMA_KEYS)[number];

const EMPTY_PHASE_2: ReadonlySet<SupportedLocale> = new Set<SupportedLocale>();

function warnMalformed(problem: string): void {
  // Degradacja do FAZY 1 jest bezpiecznym kierunkiem (pełny katalog, nie pusty),
  // ale NIE może być cicha — market, który zamierzał FAZĘ 2, musi się o tym
  // dowiedzieć inaczej niż z ruchu organicznego.
  const message = `[content-gate] content_gate ${problem} — degradacja do FAZY 1 dla wszystkich locale (AD-4)`;
  Sentry.captureMessage(message, { level: 'warning' });
  console.warn(message);
}

/**
 * Czyste zawężenie surowego bloku `content_gate` do zbioru locale w FAZIE 2.
 *
 * Świadomie GRACEFUL (w przeciwieństwie do fail-fast `narrowMarketLocales`):
 * blok jest opcjonalny, a jego brak/uszkodzenie ma dać FAZĘ 1 (pełny katalog),
 * nigdy wyjątek na ścieżce listingu. Każde odchylenie od schematu jest
 * raportowane i traktowane jak brak bloku.
 */
export function narrowPhase2Locales(rawContentGate: unknown): ReadonlySet<SupportedLocale> {
  if (rawContentGate === null || rawContentGate === undefined) {
    return EMPTY_PHASE_2;
  }

  if (typeof rawContentGate !== 'object' || Array.isArray(rawContentGate)) {
    warnMalformed('nie jest obiektem');
    return EMPTY_PHASE_2;
  }

  const record = rawContentGate as Record<string, unknown>;

  const unknownKeys = Object.keys(record).filter(
    key => !(CONTENT_GATE_SCHEMA_KEYS as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    warnMalformed(`zawiera nieznane klucze [${unknownKeys.join(', ')}] (schema additionalProperties: false)`);
    return EMPTY_PHASE_2;
  }

  const rawPhase2 = record.phase_2_locales;
  if (rawPhase2 === undefined || rawPhase2 === null) {
    return EMPTY_PHASE_2;
  }

  if (!Array.isArray(rawPhase2)) {
    warnMalformed('phase_2_locales nie jest tablicą slugów locale');
    return EMPTY_PHASE_2;
  }

  const phase2 = new Set<SupportedLocale>();
  for (const entry of rawPhase2) {
    if (typeof entry !== 'string' || !isSupportedLocale(entry)) {
      warnMalformed(
        `phase_2_locales zawiera "${String(entry)}" spoza nadzbioru platformowego [${SUPPORTED_LOCALES.join(', ')}]`
      );
      return EMPTY_PHASE_2;
    }
    phase2.add(entry);
  }

  return phase2;
}

let phase2Promise: Promise<ReadonlySet<SupportedLocale>> | null = null;

/**
 * Zbiór locale w FAZIE 2 dla tego deploymentu, z cache modułowym (ta sama
 * zasada co `resolveMarketLocales` w `market-locales.ts` — deployment jest
 * per-market, flip flagi = restart storefrontu; jawnie zaakceptowany
 * trade-off AD-2, bo flip i tak jest krokiem release-checklisty).
 *
 * Awaria odczytu configu NIE jest cache'owana i degraduje do FAZY 1.
 */
export function resolveContentGatePhase2Locales(): Promise<ReadonlySet<SupportedLocale>> {
  if (!phase2Promise) {
    phase2Promise = (async () => {
      const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID?.trim() ?? '';
      const config = await readRuntimeMarketConfig(marketId);
      return narrowPhase2Locales(config?.content_gate);
    })().catch(error => {
      warnMalformed(`nie dał się odczytać z runtime config (${String((error as Error)?.message ?? error)})`);
      phase2Promise = null;
      return EMPTY_PHASE_2;
    });
  }
  return phase2Promise;
}

/**
 * Czysty wybór sluga baru: FAZA 2 dla locale ⇒ `content_bar[locale]`,
 * w przeciwnym razie FAZA 1 ⇒ `content_bar.pl`.
 */
export function contentBarGateSlug(
  locale: string | null | undefined,
  phase2Locales: ReadonlySet<SupportedLocale>
): SupportedLocale {
  if (typeof locale !== 'string' || !isSupportedLocale(locale)) {
    return PHASE_1_GATE_SLUG;
  }
  return phase2Locales.has(locale) ? locale : PHASE_1_GATE_SLUG;
}

/** Wygodny wrapper dla warstwy danych: locale z route'u → slug baru. */
export async function resolveContentBarGateSlug(
  locale: string | null | undefined
): Promise<SupportedLocale> {
  return contentBarGateSlug(locale, await resolveContentGatePhase2Locales());
}

/** Test-only escape hatch — kod produkcyjny polega na cache modułowym. */
export function resetContentGateCacheForTests(): void {
  phase2Promise = null;
}
