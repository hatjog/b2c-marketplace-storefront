import { getTranslations } from 'next-intl/server';

interface LegalPageLayoutProps {
  children: React.ReactNode;
  showDisclaimer?: boolean;
}

export async function LegalPageLayout({ children, showDisclaimer = true }: LegalPageLayoutProps) {
  const t = await getTranslations('legal');

  return (
    <main className="min-h-screen" style={{ background: 'var(--bb-page-bg, #F3F1ED)' }}>
      <div className="bb-page-shell mx-auto max-w-[1200px]">
        {showDisclaimer && (
          <div
            className="bb-section-shell mb-2 px-5 py-4"
            style={{
              borderColor: 'var(--bb-border-soft)',
              background: 'var(--bb-surface)',
            }}
            data-testid="legal-agent-disclaimer"
          >
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('agent_disclaimer')}
            </p>
          </div>
        )}

        <div className="bb-section-shell legal-content">{children}</div>
      </div>
    </main>
  );
}
