type OverflowStrategy = 'reflow' | 'wrap' | 'ellipsis';

interface StorefrontI18nLongContentProbeProps {
  locale: string;
  surface: string;
  overflowStrategy?: OverflowStrategy;
}

export function StorefrontI18nLongContentProbe({
  locale,
  surface,
  overflowStrategy = 'reflow',
}: StorefrontI18nLongContentProbeProps) {
  return (
    <div
      hidden
      data-testid="storefront-i18n-long-content-probe"
      data-locale={locale}
      data-surface={surface}
      data-overflow-strategy={overflowStrategy}
    />
  );
}
