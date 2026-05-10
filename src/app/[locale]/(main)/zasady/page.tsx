/**
 * Story v170-2-9: Zasady page — voucher rules.
 * Extended with a link to /pomoc for consumer withdrawal info (AC2).
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

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
  const tW = await getTranslations('voucher_withdrawal');

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

      {/* Consumer withdrawal note — FR64 (Story v170-2-9) */}
      <section
        aria-labelledby="zasady-withdrawal-heading"
        data-testid="zasady-withdrawal-section"
        className="border-b border-secondary py-8 last:border-b-0"
      >
        <h2 id="zasady-withdrawal-heading" className="mb-4 text-xl font-semibold">
          {tW('legal.section_title')}
        </h2>
        <p className="prose text-sm text-secondary mb-4">
          {tW('legal.window_body')}
        </p>
        <p className="prose text-sm text-secondary mb-4">
          {tW('legal.consent_body')}
        </p>
        <a
          href="/pomoc"
          className="text-sm underline"
          data-testid="zasady-pomoc-link"
        >
          {tW('legal.contact_support')} →
        </a>
      </section>
    </main>
  );
}
