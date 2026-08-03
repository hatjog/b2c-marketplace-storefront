export const TabsContent = ({
  children,
  value,
  activeTab,
  idBase = 'tabs',
  'data-testid': dataTestId
}: {
  children: React.ReactNode;
  value: string;
  activeTab: string;
  idBase?: string;
  'data-testid'?: string;
}) => {
  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${idBase}-${value}-panel`}
      aria-labelledby={`${idBase}-${value}-tab`}
      data-testid={dataTestId ?? 'tabs-content'}
    >
      {children}
    </div>
  );
};
