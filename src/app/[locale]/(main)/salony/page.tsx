import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import { SellerCard } from '@/components/organisms/seller/SellerCard';
import { getSellers } from '@/lib/data/seller';

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Salony partnerskie | BonBeauty';
  const description =
    'Odkryj salony partnerskie BonBeauty. Znajdź salon w swoim mieście i przeglądaj ich ofertę.';

  return {
    title,
    description,
    openGraph: {
      title,
      description
    }
  };
}

export default async function SalonyPage() {
  const sellers = await getSellers();

  return (
    <main id="main-content" className="container py-8">
      <Breadcrumbs
        items={[
          { label: 'Strona główna', href: '/' },
          { label: 'Salony', href: '/salony' }
        ]}
      />

      <h1 className="mt-6 mb-8 text-2xl font-bold">Salony partnerskie</h1>

      {sellers.length === 0 ? (
        <p className="text-gray-500">Brak salonów partnerskich.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {sellers.map((seller) => (
            <SellerCard
              key={seller.handle}
              name={seller.name}
              handle={seller.handle}
              photo_url={seller.photo_url}
              city={seller.city}
              product_count={seller.product_count}
            />
          ))}
        </div>
      )}
    </main>
  );
}
