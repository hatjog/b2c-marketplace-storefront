import { getTranslations } from 'next-intl/server';

interface LegalPageLayoutProps {
  children: React.ReactNode;
  showDisclaimer?: boolean;
}

export async function LegalPageLayout({ children, showDisclaimer = true }: LegalPageLayoutProps) {
  const t = await getTranslations('legal');

  return (
    <main className="min-h-screen" style={{ background: '#F3F1ED' }}>
      <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8 md:py-16">
        {showDisclaimer && (
          <div
            className="mb-8 rounded-sm border border-[#7A7672]/30 bg-[#F3F1ED] px-5 py-4"
            data-testid="legal-agent-disclaimer"
          >
            <p className="text-sm leading-relaxed" style={{ color: '#7A7672', fontFamily: 'Inter, sans-serif' }}>
              {t('agent_disclaimer')}
            </p>
          </div>
        )}

        <div className="legal-content">{children}</div>
      </div>
    </main>
  );
}
