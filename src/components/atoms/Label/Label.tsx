export const Label = ({
  children,
  'data-testid': dataTestId
}: {
  children: React.ReactNode;
  'data-testid'?: string;
}) => {
  return (
    <span
      className="label-sm rounded-sm border px-3 py-2"
      data-testid={dataTestId ?? 'label'}
    >
      {children}
    </span>
  );
};
