/**
 * Showcase route: Wave-6 chrome component-only surfaces.
 *
 * PROD-SAFE: gated by NEXT_PUBLIC_GP_SHOWCASE=1 env flag.
 * - Not linked in any nav.
 * - Adds noindex/nofollow robots meta.
 * - Animations disabled via data-showcase attribute + CSS override.
 *
 * Purpose: deterministic visual capture for golden baseline (Story 7.3 / 7.11).
 * Mounts SearchOverlay, ToastViewport (all 4 variants) and ModalShell in open/visible state,
 * no timers, no auto-dismiss.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ShowcaseChrome } from './_client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// No dynamic functions used — opt-in to static where possible,
// but notFound() makes it effectively dynamic per request.
export default function ShowcaseChromePage() {
  // Prod-safety gate: when the flag is absent or not "1", return 404.
  if (process.env.NEXT_PUBLIC_GP_SHOWCASE !== '1') {
    notFound();
  }

  return <ShowcaseChrome />;
}
