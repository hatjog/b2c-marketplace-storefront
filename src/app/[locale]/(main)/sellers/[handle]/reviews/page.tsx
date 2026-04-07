import { SellerTabs } from '@/components/organisms/SellerTabs/SellerTabs';
import { SellerPageHeader } from '@/components/sections';
import { retrieveCustomer } from '@/lib/data/customer';
import { getRegion } from '@/lib/data/regions';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getSellerByHandle } from '@/lib/data/seller';

export default async function SellerReviewsPage({
  params
}: {
  params: Promise<{ handle: string; locale: string }>;
}) {
  const { handle, locale } = await params;

  const seller = await getSellerByHandle(handle);

  if (!seller) return null;

  const countryCode = await getCountryCode(locale);
  const currency_code = (await getRegion(countryCode))?.currency_code || 'usd';

  const user = await retrieveCustomer();

  const tab = 'reviews';

  return (
    <main id="main-content" className="bb-page-shell">
      <SellerPageHeader
        header
        seller={seller}
        user={user}
      />
      <SellerTabs
        tab={tab}
        seller_id={seller.id}
        seller_handle={seller.handle}
        locale={locale}
        countryCode={countryCode}
        currency_code={currency_code}
      />
    </main>
  );
}
