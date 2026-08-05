/**
 * Powierzchnia odczytu wieku danych sitemapy — Story 2.2 v1.15.0 (AC4, AD-19).
 *
 * KONSUMENT (nazwany, bo „widoczne w logu, do którego nikt nie zagląda" nie
 * spełnia AD-19):
 *   1. smoke pre-promote na realnej gp-config (`tests/prod-stack-liveness`
 *      i procedura promote) — sprawdza `status` i `max_age_seconds`,
 *   2. operator dyżurny wg progu i właściciela zapisanych w
 *      `specs/releases/v1.15.0/sitemap-degradation-threshold.md`.
 *
 * Endpoint NIE regeneruje sitemapy — raportuje licznik degradacji tego procesu
 * oraz wiek ostatniego dobrego wyniku odczytany z nośnika.
 *
 * CZEGO TU NIE MA I DLACZEGO (review 2.2 [LOW]):
 * endpoint jest publiczny (bez guardu), więc NIE zwraca `last_good_store`
 * (absolutna ścieżka w systemie plików kontenera) ani `threshold_owner`
 * (imię i nazwisko realnej osoby). AC4 i SSOT progu wymagają, żeby wiek danych
 * i próg były ODCZYTYWALNE PRZEZ NAZWANEGO KONSUMENTA — nie żeby dane osobowe
 * i topologia wdrożenia były dostępne dla dowolnego żądania z internetu.
 * Właściciel progu pozostaje zapisany w SSOT (`threshold_owner_ref` niżej)
 * oraz w logu strukturalnym `sitemap.degraded`, który jest wewnętrzny.
 */
import { NextResponse } from 'next/server';

import { getSitemapDegradationMetrics } from '@/lib/seo/sitemap-degradation';
import {
  readLastGood,
  snapshotAgeSeconds,
  type SitemapSourceId
} from '@/lib/seo/sitemap-last-good';

export const dynamic = 'force-dynamic';

const SOURCES: SitemapSourceId[] = ['categories', 'sellers', 'blog_posts'];

export async function GET() {
  const now = new Date();
  const sources: Record<string, { fetched_at: string | null; age_seconds: number | null }> = {};

  for (const source of SOURCES) {
    const snapshot = await readLastGood(source);
    sources[source] = snapshot
      ? { fetched_at: snapshot.fetchedAt, age_seconds: snapshotAgeSeconds(snapshot, now) }
      : { fetched_at: null, age_seconds: null };
  }

  const metrics = getSitemapDegradationMetrics();

  return NextResponse.json(
    {
      checked_at: now.toISOString(),
      sources,
      degradation: {
        fresh_generations: metrics.freshGenerations,
        degraded_generations: metrics.degradedGenerations,
        failed_generations: metrics.failedGenerations,
        last_degraded_at: metrics.lastDegradedAt,
        last_max_age_seconds: metrics.lastMaxAgeSeconds,
        threshold_seconds: metrics.thresholdSeconds,
        // Wskaźnik do SSOT zamiast danych osobowych właściciela.
        threshold_owner_ref: 'specs/releases/v1.15.0/sitemap-degradation-threshold.md',
        threshold_enforced_from: metrics.thresholdEnforcedFrom,
        threshold_breached: metrics.thresholdBreached
      }
    },
    {
      headers: {
        'cache-control': 'no-store',
        // Powierzchnia operacyjna, nie treść — nie ma po co trafiać do indeksu.
        // Nagłówek jest tu, a nie w `robots.ts`, żeby wykluczenie jechało razem
        // z endpointem i nie zależało od polityki innego pliku (review 2.2 [LOW]).
        'x-robots-tag': 'noindex, nofollow'
      }
    }
  );
}
