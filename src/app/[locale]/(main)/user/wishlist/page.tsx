import type { HttpTypes } from '@medusajs/types';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { WishlistItem } from '@/components/cells';
import { loadWishlist, toDisplayName } from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';
import { getCountryCode } from '@/lib/helpers/country-code';

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'accountRead.wishlist' }),
    retrieveCustomer()
  ]);

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const countryCode = await getCountryCode(locale);
  const result = await loadWishlist(countryCode);

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-09"
      user={{
        id: customer.id,
        displayName: toDisplayName(customer) ?? customer.email,
        email: customer.email
      }}
      snapshotSections={[
        { id: 'wishlist', label: t('snapshot.wishlist'), value: String(result.data.products?.length ?? 0) },
        { id: 'email', label: t('snapshot.email'), value: customer.email }
      ]}
      mainContent={
        <div className="space-y-6" data-testid="wishlist-page">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="heading-md text-primary">{t('heading')}</h2>
              <p className="text-sm text-secondary">{t('intro')}</p>
            </div>
            <Link href={`/${locale}/categories`} className="text-sm font-medium text-action">
              {t('browse')}
            </Link>
          </div>
          {result.state === 'access_denied' ? (
            <StateCard variant="error" title={t('error.access_denied_title')} description={t('error.access_denied_body')} />
          ) : result.state === 'failed' ? (
            <StateCard variant="error" title={t('error.failed_title')} description={t('error.failed_body')} />
          ) : result.state === 'unavailable' ? (
            <StateCard variant="unavailable" title={t('error.unavailable_title')} description={t('error.unavailable_body')} />
          ) : (result.data.products ?? []).length === 0 ? (
            <StateCard variant="empty" title={t('empty.title')} description={t('empty.body')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(result.data.products ?? []).map(product => (
                <div
                  key={product.id}
                  className="bb-card"
                  style={{
                    background: 'var(--journal-card-bg, var(--bb-surface))',
                    borderColor: 'var(--journal-card-border)',
                    borderRadius: 'var(--journal-card-radius, 16px)',
                    boxShadow: 'var(--journal-card-shadow)'
                  }}
                  data-testid={`wishlist-item-${product.id}`}
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t('collection')}</p>
                  <WishlistItem
                    product={product as HttpTypes.StoreProduct & { calculated_amount: number; currency_code: string }}
                    wishlist={result.data}
                    user={customer}
                    testIdPrefix={`wishlist-item-${product.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
