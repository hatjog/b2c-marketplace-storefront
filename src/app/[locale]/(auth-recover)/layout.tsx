/**
 * (auth-recover) route group layout — Story 5.3 W3-05/W3-06.
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review HIGH-2):
 *   - Sibling to (auth) group; routes here render AuthLayout T3 slim shell
 *     (no SiteHeader, no SiteFooter, no MiniCart, no MobileBottomNav).
 *   - Region-gated identically to (auth): if checkRegion fails, redirect to
 *     home.
 *   - Story 5.4 AC10 chrome-separation guardrail (UX-DR12).
 */

import { redirect } from 'next/navigation';

import { checkRegion } from '@/lib/helpers/check-region';

export default async function AuthRecoverLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const regionCheck = await checkRegion(locale);

  if (!regionCheck) {
    return redirect('/');
  }

  return children;
}
