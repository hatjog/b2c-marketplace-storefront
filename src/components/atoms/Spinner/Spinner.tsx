export const Spinner = ({ 'data-testid': dataTestId }: { 'data-testid'?: string }) => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-primary border-b-transparent"
      data-testid={dataTestId ?? 'spinner'}
    ></div>
  );
};
