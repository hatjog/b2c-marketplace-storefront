import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Breadcrumbs } from '@/components/atoms';
import { SanitizedHTML } from '@/components/molecules';
import { getMarketId } from '@/lib/helpers/market-filter';
import { resolveZasadySections } from '@/lib/runtime-market-config';

export async function generateMetadata(): Promise<Metadata> {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  return {
    title: `Zasady — ${siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function ZasadyPage() {
  const marketId = getMarketId();
  const sections = await resolveZasadySections(marketId);

  if (!sections) {
    redirect('/');
  }

  return (
    <main id="main-content" className="container mx-auto max-w-[720px] px-4 py-8">
      <div className="mb-2 hidden md:block">
        <Breadcrumbs items={[{ path: 'zasady', label: 'Zasady' }]} />
      </div>

      <h1 className="heading-xl mb-8">Zasady</h1>

      {sections.map((section, i) => (
        <section key={i} className="border-b border-secondary py-8 last:border-b-0">
          <h2 className="mb-4 text-xl font-semibold">{section.title}</h2>
          <SanitizedHTML html={section.body} className="prose text-sm text-secondary" />
        </section>
      ))}
    </main>
  );
}
