interface SpinnerProps {
  'data-testid'?: string;
  'aria-label': string;
}

export const Spinner = ({ 'data-testid': dataTestId, 'aria-label': ariaLabel }: SpinnerProps) => {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-primary border-b-transparent"
      data-testid={dataTestId ?? 'spinner'}
    ></div>
  );
};
