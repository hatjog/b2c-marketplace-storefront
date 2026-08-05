/**
 * Licznik degradacji sitemapy + próg z właścicielem — Story 2.2 v1.15.0 (AD-19, AC4).
 *
 * AD-19: odpowiedź zdegradowana jest legalna WYŁĄCZNIE wtedy, gdy niesie wiek
 * danych widoczny dla odbiorcy i licznik porównywany z progiem MAJĄCYM
 * WŁAŚCICIELA. Próg i właściciel są zapisane w SSOT:
 *   specs/releases/v1.15.0/sitemap-degradation-threshold.md
 * (ten plik jest projekcją tamtego zapisu do kodu, nie jego źródłem).
 *
 * Populacji progu dziś nie ma — nie istnieje instancja produkcyjna do v1.20.0.
 * Dlatego próg jest zapisany jako WYMAGALNY OD pierwszego realnego ruchu
 * produkcyjnego (wzorzec NFR-11), z jawną wersją poniżej.
 */

/** Powyżej tego wieku serwowanie z ostatniego dobrego wyniku jest incydentem. */
export const SITEMAP_STALE_ALERT_THRESHOLD_SECONDS = 24 * 3600;

/** Właściciel z imienia — nie „zespół". */
export const SITEMAP_DEGRADATION_THRESHOLD_OWNER = 'Robert Szymański (PO BonBeauty)';

/** Od kiedy próg jest wymagalny (brak populacji przed produkcją). */
export const SITEMAP_DEGRADATION_THRESHOLD_ENFORCED_FROM =
  'v1.20.0 — pierwszy realny ruch produkcyjny (przed tym wydaniem próg nie ma populacji)';

export interface SitemapDegradationMetrics {
  freshGenerations: number;
  degradedGenerations: number;
  failedGenerations: number;
  lastDegradedAt: string | null;
  lastMaxAgeSeconds: number | null;
  thresholdSeconds: number;
  thresholdOwner: string;
  thresholdEnforcedFrom: string;
  /** Czy ostatnia degradacja przekroczyła próg (dziś: sygnał, nie bramka). */
  thresholdBreached: boolean;
}

const counters = {
  freshGenerations: 0,
  degradedGenerations: 0,
  failedGenerations: 0,
  lastDegradedAt: null as string | null,
  lastMaxAgeSeconds: null as number | null,
  thresholdBreached: false
};

export function recordFreshGeneration(): void {
  counters.freshGenerations += 1;
}

export function recordDegradedGeneration(
  maxAgeSeconds: number,
  degradedSources: string[],
  now: Date = new Date()
): void {
  counters.degradedGenerations += 1;
  counters.lastDegradedAt = now.toISOString();
  counters.lastMaxAgeSeconds = maxAgeSeconds;
  counters.thresholdBreached = maxAgeSeconds > SITEMAP_STALE_ALERT_THRESHOLD_SECONDS;
  // Log strukturalny — druga (obok /api/seo/sitemap-health) powierzchnia,
  // na której wiek danych jest widoczny dla odbiorcy.
  console.warn(
    JSON.stringify({
      event: 'sitemap.degraded',
      degraded_sources: degradedSources,
      max_age_seconds: maxAgeSeconds,
      threshold_seconds: SITEMAP_STALE_ALERT_THRESHOLD_SECONDS,
      threshold_owner: SITEMAP_DEGRADATION_THRESHOLD_OWNER,
      threshold_breached: counters.thresholdBreached,
      degraded_generations: counters.degradedGenerations
    })
  );
}

export function recordFailedGeneration(failedSources: string[]): void {
  counters.failedGenerations += 1;
  console.error(
    JSON.stringify({
      event: 'sitemap.failed',
      failed_sources: failedSources,
      failed_generations: counters.failedGenerations,
      note: 'nie publikujemy nowej wersji artefaktu (AD-19 fail-closed)'
    })
  );
}

export function getSitemapDegradationMetrics(): SitemapDegradationMetrics {
  return {
    ...counters,
    thresholdSeconds: SITEMAP_STALE_ALERT_THRESHOLD_SECONDS,
    thresholdOwner: SITEMAP_DEGRADATION_THRESHOLD_OWNER,
    thresholdEnforcedFrom: SITEMAP_DEGRADATION_THRESHOLD_ENFORCED_FROM
  };
}

/** Wyłącznie dla testów — produkcyjnie licznik żyje tyle, co proces. */
export function __resetSitemapDegradationMetricsForTests(): void {
  counters.freshGenerations = 0;
  counters.degradedGenerations = 0;
  counters.failedGenerations = 0;
  counters.lastDegradedAt = null;
  counters.lastMaxAgeSeconds = null;
  counters.thresholdBreached = false;
}
