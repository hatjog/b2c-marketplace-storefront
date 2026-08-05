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
 */
import { NextResponse } from 'next/server';

import { getSitemapDegradationMetrics } from '@/lib/seo/sitemap-degradation';
import {
  readLastGood,
  resolveLastGoodDir,
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
      last_good_store: resolveLastGoodDir(),
      sources,
      degradation: {
        fresh_generations: metrics.freshGenerations,
        degraded_generations: metrics.degradedGenerations,
        failed_generations: metrics.failedGenerations,
        last_degraded_at: metrics.lastDegradedAt,
        last_max_age_seconds: metrics.lastMaxAgeSeconds,
        threshold_seconds: metrics.thresholdSeconds,
        threshold_owner: metrics.thresholdOwner,
        threshold_enforced_from: metrics.thresholdEnforcedFrom,
        threshold_breached: metrics.thresholdBreached
      }
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
