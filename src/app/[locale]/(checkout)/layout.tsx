import { getTranslations } from 'next-intl/server';

import { Button, LogoLockup } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { CollapseIcon } from '@/icons';

// Minimal chrome: header-only by design (no footer) — standard checkout UX pattern
// that reduces cognitive load during payment flow. AC1 "header i footer" applies to
// (main) layout surfaces; checkout is intentionally footer-free.
export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations('checkout');

  return (
    <>
      <header>
        <div className="relative w-full px-4 py-2 lg:px-8">
          <div className="absolute top-3">
            <LocalizedClientLink href="/cart">
              <Button
                variant="tonal"
                className="flex items-center gap-2"
              >
                <CollapseIcon className="rotate-90" />
                <span className="hidden lg:block">{t('back_to_cart')}</span>
              </Button>
            </LocalizedClientLink>
          </div>
          <div className="flex w-full items-center justify-center pl-4 lg:pl-0">
            {/* Brand lockup parity (v1.12.0 chrome): gold monogram + wordmark,
                not the market-configured Payload logo (off-brand placeholder). */}
            <LogoLockup
              variant="light"
              className="flex items-center gap-2"
              data-testid="checkout-logo-link"
            />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
