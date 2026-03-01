export const Dropdown = ({
  children,
  show,
  'data-testid': dataTestId
}: {
  children: React.ReactNode;
  show: boolean;
  'data-testid'?: string;
}) => {
  if (!show) return null;

  return (
    <div
      className="absolute -right-2 z-20 w-max rounded-sm border border-primary bg-primary text-primary"
      data-testid={dataTestId ?? 'dropdown'}
    >
      {children}
    </div>
  );
};
