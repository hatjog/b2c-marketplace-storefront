/**
 * UX Evidence Metadata helper — Story v170-2-10
 *
 * Emits per-artifact .meta.json sidecars conformant with
 * specs/contracts/governance/schemas/ux-evidence-bundle.v1.schema.json
 * artifact entry shape (AC-UX13-01 through AC-UX13-07, UX-DR24).
 *
 * IMPORTANT: This helper is storefront-internal. Do NOT import it from
 * apps/web or any other workspace (AC-S6-04 boundary).
 */
import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ArtifactMeta {
  release_id: string;
  market_id: string;
  surface: 'storefront' | 'apps-web-salon';
  role: 'customer' | 'salon-user';
  path: string;
  path_slug: string;
  viewport: number;
  locale: string;
  check: string;
  ac_ref: string;
  artifact_path: string;
  command: string;
  timestamp: string;
  git_sha: string;
  result: 'PASS' | 'FAIL' | 'WAIVED WITH OWNER + EXPIRY';
  notes?: string;
}

/**
 * Emit a .meta.json sidecar alongside the artifact file.
 * Called after each Playwright screenshot / axe / keyboard evidence capture.
 */
export function emitMeta(meta: ArtifactMeta): void {
  const metaPath = meta.artifact_path.replace(/(\.[^.]+)$/, '.meta.json');
  const dir = path.dirname(metaPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

/**
 * Zapisz PEŁNY raport axe pod ścieżką artefaktu (review-fix HIGH-1).
 *
 * `emitMeta` zapisuje WYŁĄCZNIE sidecar `.meta.json` z werdyktem `PASS`/`FAIL`.
 * Scenariusze deklarowały `artifact_path` wskazujący plik `.axe.json`, którego
 * NIKT nie produkował — czyli warunek „raport axe jest osobnym artefaktem
 * evidence" był nieosiągalny nawet po uruchomieniu Playwrighta. Nie brakowało
 * przebiegu; brakowało kodu, który raport zapisuje.
 */
export function writeAxeReport(artifactPath: string, results: unknown): void {
  const dir = path.dirname(artifactPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(artifactPath, JSON.stringify(results, null, 2) + '\n', 'utf-8');
}

/** Rozwiązuje artefakt względem superprojektu, nie względem `GP/storefront`. */
export function resolveEvidenceArtifactPath(repoRelativePath: string): string {
  const superprojectRoot = execSync('git rev-parse --show-superproject-working-tree', {
    encoding: 'utf-8',
    timeout: 5000
  }).trim();
  if (!superprojectRoot) {
    throw new Error('UX evidence wymaga storefrontu uruchomionego jako submoduł GP');
  }

  const evidenceRoot = path.resolve(superprojectRoot, '_bmad-output');
  const resolved = path.resolve(superprojectRoot, repoRelativePath);
  if (resolved !== evidenceRoot && !resolved.startsWith(`${evidenceRoot}${path.sep}`)) {
    throw new Error(`Artefakt wychodzi poza śledzone drzewo evidence: ${resolved}`);
  }
  return resolved;
}

/** Kontrola po zapisie: producent nie może pisać do pliku niewidocznego dla gita. */
export function assertTrackedEvidenceArtifact(artifactPath: string): void {
  const superprojectRoot = execSync('git rev-parse --show-superproject-working-tree', {
    encoding: 'utf-8',
    timeout: 5000
  }).trim();
  const relativePath = path.relative(superprojectRoot, artifactPath);
  execFileSync('git', ['-C', superprojectRoot, 'ls-files', '--error-unmatch', '--', relativePath], {
    encoding: 'utf-8',
    timeout: 5000
  });
}

/**
 * Resolve the current git SHA for traceability.
 * Falls back to "unknown" if git is unavailable.
 */
export function resolveGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8', timeout: 5000 }).trim().slice(0, 40);
  } catch {
    return 'unknown';
  }
}

/**
 * Build a standard command string for a UX evidence spec run.
 * Used in artifact metadata for reproducibility (AC3 traceability requirement).
 */
export function buildCommand(specFile: string, project: string): string {
  return `pnpm test:ux-evidence -- --project=${project} ${specFile}`;
}

/**
 * Resolve the viewport width from the Playwright test's viewport configuration.
 * Returns 0 if viewport is not set (should not happen in ux-evidence runs).
 */
export function resolveViewport(viewport: { width: number; height: number } | null): number {
  return viewport?.width ?? 0;
}

/**
 * Standard evidence output path under _bmad-output evidence directory.
 * Relative to the repo root (super-repo path convention).
 */
export const EVIDENCE_BASE = '_bmad-output/releases/v1.7.0/implementation-artifacts/evidence';

export const RELEASE_ID = 'v1.7.0';
export const MARKET_ID = 'bonbeauty';
