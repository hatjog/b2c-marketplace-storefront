const SkeletonCardDetails = () => {
  return (
    <div
      className="my-4 flex flex-col gap-1 transition-all duration-150 ease-in-out"
      data-testid="skeleton-card-details"
    >
      <div className="bg-ui-bg-component-pressed mb-1 h-4 w-1/4 animate-pulse rounded-md"></div>
      <div className="bg-ui-bg-field border-ui-border-base mt-0 block h-11 w-full animate-pulse appearance-none rounded-md border px-4 pb-1 pt-3" />
    </div>
  );
};

export default SkeletonCardDetails;
