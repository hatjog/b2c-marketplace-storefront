/**
 * Story v170-2-9: Zasady page — voucher rules.
 * Extended with a link to /pomoc for consumer withdrawal info (AC2).
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  Breadcrumbs,
  StorefrontI18nLongContentProbe,
  StorefrontRouteStateSignal
} from '@/components/atoms';
import { SanitizedHTML } from '@/components/molecules';
import { getMarketId } from '@/lib/helpers/market-filter';
import { resolveZasadySections } from '@/lib/runtime-market-config';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('title_zasady'),
    description: t('zasady_description'),
    robots: { index: false, follow: false }
  };
}

export default async function ZasadyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const marketId = getMarketId();
  const sections = await resolveZasadySections(marketId);
  const tW = await getTranslations({ locale, namespace: 'voucher_withdrawal' });
  const tLegal = await getTranslations({ locale, namespace: 'legal' });

  if (!sections) {
    redirect(`/${locale}`);
  }

  return (
    <main
      id="main-content"
      className="bb-page-shell"
    >
      <StorefrontRouteStateSignal
        route="legal-zasady"
        surface="legal-zasady"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="legal-zasady"
      />
      <div className="bb-legal-cms-shell">
        <div className="mb-2 hidden md:block">
          <Breadcrumbs items={[{ path: 'zasady', label: tLegal('title_zasady') }]} />
        </div>

        <h1 className="heading-xl mb-8 text-[var(--text-primary)]">{tLegal('title_zasady')}</h1>

        {sections.map((section, i) => (
          <section
            key={i}
            className="border-b border-[var(--bb-border-soft)] py-8 last:border-b-0"
          >
            <h2 className="heading-md mb-4 text-[var(--text-primary)]">{section.title}</h2>
            <SanitizedHTML
              html={section.body}
              className="bb-prose"
            />
          </section>
        ))}

        {/* Consumer withdrawal note — FR64 (Story v170-2-9) */}
        <section
          aria-labelledby="zasady-withdrawal-heading"
          data-testid="zasady-withdrawal-section"
          className="border-b border-[var(--bb-border-soft)] py-8 last:border-b-0"
        >
          <h2
            id="zasady-withdrawal-heading"
            className="heading-md mb-4 text-[var(--text-primary)]"
          >
            {tW('legal.section_title')}
          </h2>
          <p className="bb-prose mb-4">{tW('legal.window_body')}</p>
          <p className="bb-prose mb-4">{tW('legal.consent_body')}</p>
          <Link
            href={`/${locale}/pomoc`}
            className="text-sm font-medium text-[var(--text-primary)] underline decoration-[var(--bb-tint-gold-24)] underline-offset-4"
            data-testid="zasady-pomoc-link"
          >
            {tW('legal.contact_support')} →
          </Link>
        </section>
      </div>
    </main>
  );
}
