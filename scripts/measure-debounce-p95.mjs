#!/usr/bin/env node
/**
 * Story 7.5 / AC3 / ra-6 — harness pomiaru p95 debounce re-measure (200 vs 300).
 *
 * Liczy p95 (nearest-rank, deterministyczny — mirror
 * `src/components/SellerMap/debounce.ts`) z REALNYCH próbek latency re-measure
 * mapy (`invalidateSize` po resize) zebranych na żywym storefront stacku i scala
 * je do evidence JSON konsumowanego przez
 * `_grow/tools/validate_maptiler_live_evidence.py`.
 *
 * NIE fabrykuje: bez realnych próbek dla OBU wariantów (200 i 300) wychodzi z
 * błędem — nie wypisze wartości p95 ani `captured: true`. To jest mechanizm
 * pomiaru, nie generator zmyślonych metryk (NEEDS-LIVE-RUN dopóki nie ma próbek
 * z żywego stacku).
 *
 * Próbki: pliki tekstowe/JSON z liczbami ms (po jednej w linii lub tablica JSON).
 *
 * Użycie:
 *   node scripts/measure-debounce-p95.mjs \
 *     --samples-200 <plik> --samples-300 <plik> \
 *     --env "<opis>" --date "<YYYY-MM-DD>" --source "<źródło>" \
 *     --console-errors 0 --route /pl/sellers --tile-source maptiler \
 *     --evidence-url "<url>" --chosen 200 --release v1.12.0 \
 *     --out <ścieżka evidence.json>
 *
 * SEMANTICS NOTE — co mierzy ta metryka:
 *   Próbki = `performance.now() - lastResizeAt` (czas od resize do odpalenia
 *   debounce'owanego invalidateSize). Mierzy **okno debounce + praca invalidateSize**.
 *   Praca invalidateSize jest sub-milisekundowa (~0.2–0.6 ms), więc próbki są
 *   zdominowane przez celowy timer (debounceMs). Metryka potwierdza, że wybrany
 *   wariant debounce (200 ms) < próg 300 ms, ale NIE mierzy wydajności samej
 *   operacji reassess. Pole `metric_semantics` w output JSON dokumentuje to
 *   explicite. Szczegóły: `MapResizeInvalidator.tsx` + finding #2 review 7-8.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** percentyl nearest-rank — mirror debounce.ts (deterministyczny, C8). */
function percentile(samplesMs, p) {
  if (!Array.isArray(samplesMs) || samplesMs.length === 0) {
    throw new Error('percentile: pusta próbka — brak pomiaru (skip != green)');
  }
  if (p < 0 || p > 100) throw new Error(`percentile: p poza zakresem 0..100 (${p})`);
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
  return sorted[index];
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function loadSamples(path) {
  const raw = readFileSync(path, 'utf-8').trim();
  let values;
  if (raw.startsWith('[')) {
    values = JSON.parse(raw);
  } else {
    values = raw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number);
  }
  const nums = values.filter(n => typeof n === 'number' && Number.isFinite(n) && n >= 0);
  if (nums.length === 0) {
    throw new Error(`brak realnych próbek latency w ${path} (NIE fabrykować)`);
  }
  return nums;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args['samples-200'] || !args['samples-300']) {
    console.error(
      'BŁĄD: wymagane --samples-200 i --samples-300 (realne próbki z żywego stacku). ' +
        'Harness NIE fabrykuje p95 — bez próbek to NEEDS-LIVE-RUN.'
    );
    process.exit(2);
  }

  const s200 = loadSamples(args['samples-200']);
  const s300 = loadSamples(args['samples-300']);

  if (s200.length !== s300.length) {
    console.error(
      `OSTRZEŻENIE: różne rozmiary próbek (200:${s200.length} vs 300:${s300.length}). ` +
        'sample_size = min(obu) dla porównywalności.'
    );
  }
  const sampleSize = Math.min(s200.length, s300.length);

  const consoleErrors =
    args['console-errors'] !== undefined ? Number(args['console-errors']) : null;

  const evidence = {
    schema: 'gp.maptiler-live.v1',
    release: args.release ?? 'v1.11.0',
    captured: true,
    needs_live_run: false,
    stack: args.stack || 'storefront-live',
    console: {
      route: args.route ?? null,
      tile_source: args['tile-source'] ?? null,
      console_errors: Number.isFinite(consoleErrors) ? consoleErrors : null,
      console_warnings:
        args['console-warnings'] !== undefined ? Number(args['console-warnings']) : null,
      evidence_url: args['evidence-url'] ?? null
    },
    debounce_p95: {
      p95_200_ms: percentile(s200, 95),
      p95_300_ms: percentile(s300, 95),
      sample_size: sampleSize,
      chosen_variant_ms: args.chosen !== undefined ? Number(args.chosen) : 200,
      env: args.env ?? null,
      date: args.date ?? null,
      source: args.source ?? null
    },
    metric_semantics: {
      measures: 'debounce_timer_plus_invalidateSize_work',
      note:
        'Próbki = performance.now() - lastResizeAt (czas od resize do odpalenia ' +
        'debounce\'owanego invalidateSize). Praca invalidateSize jest sub-milisekundowa ' +
        '(~0.2–0.6 ms), więc próbki są zdominowane przez celowy timer debounce. ' +
        'Metryka potwierdza chosen_variant_ms < próg, ale nie mierzy wydajności ' +
        'samej operacji reassess w izolacji.',
      work_isolation_note:
        'Jeśli wymagane jest zmierzenie samego kosztu invalidateSize, należy dodać ' +
        'osobną instrumentację wokół wywołania invalidateSize() w MapResizeInvalidator.'
    }
  };

  const json = JSON.stringify(evidence, null, 2);
  if (args.out) {
    writeFileSync(args.out, json + '\n', 'utf-8');
    console.error(`zapisano evidence: ${args.out}`);
  } else {
    process.stdout.write(json + '\n');
  }
}

main();
