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
import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

export interface ArtifactMeta {
  release_id: string
  market_id: string
  surface: "storefront" | "apps-web-salon"
  role: "customer" | "salon-user"
  path: string
  path_slug: string
  viewport: number
  locale: string
  check: string
  ac_ref: string
  artifact_path: string
  command: string
  timestamp: string
  git_sha: string
  result: "PASS" | "FAIL" | "WAIVED WITH OWNER + EXPIRY"
  notes?: string
}

/**
 * Emit a .meta.json sidecar alongside the artifact file.
 * Called after each Playwright screenshot / axe / keyboard evidence capture.
 */
export function emitMeta(meta: ArtifactMeta): void {
  const metaPath = meta.artifact_path.replace(/(\.[^.]+)$/, ".meta.json")
  const dir = path.dirname(metaPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8")
}

/**
 * Resolve the current git SHA for traceability.
 * Falls back to "unknown" if git is unavailable.
 */
export function resolveGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", timeout: 5000 })
      .trim()
      .slice(0, 40)
  } catch {
    return "unknown"
  }
}

/**
 * Build a standard command string for a UX evidence spec run.
 * Used in artifact metadata for reproducibility (AC3 traceability requirement).
 */
export function buildCommand(specFile: string, project: string): string {
  return `pnpm test:ux-evidence -- --project=${project} ${specFile}`
}

/**
 * Resolve the viewport width from the Playwright test's viewport configuration.
 * Returns 0 if viewport is not set (should not happen in ux-evidence runs).
 */
export function resolveViewport(viewport: { width: number; height: number } | null): number {
  return viewport?.width ?? 0
}

/**
 * Standard evidence output path under _bmad-output evidence directory.
 * Relative to the repo root (super-repo path convention).
 */
export const EVIDENCE_BASE =
  "_bmad-output/releases/v1.7.0/implementation-artifacts/evidence"

export const RELEASE_ID = "v1.7.0"
export const MARKET_ID = "bonbeauty"
