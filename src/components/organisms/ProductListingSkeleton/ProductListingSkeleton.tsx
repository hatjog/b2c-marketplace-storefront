export const ProductListingSkeleton = () => {
  return (
    <div
      className="py-4"
      data-testid="product-listing-skeleton"
    >
      <div className="items-center justify-between lg:flex lg:h-10">
        <div className="h-6 w-20 animate-pulse rounded-sm bg-secondary" />
        <div className="hidden h-10 w-[200px] animate-pulse rounded-sm bg-secondary lg:block" />
        <div className="mb-2 mt-4 flex gap-2 lg:hidden">
          <div className="h-[38px] w-1/2 animate-pulse rounded-sm bg-secondary" />
          <div className="h-[38px] w-1/2 animate-pulse rounded-sm bg-secondary" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4">
        <div>
          <div className="h-80 animate-pulse rounded-sm border border-white bg-secondary" />
          <div className="h-80 animate-pulse rounded-sm border border-white bg-secondary" />
          <div className="h-80 animate-pulse rounded-sm border border-white bg-secondary" />
        </div>
        <div className="col-span-3">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3">
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
            <div className="h-[600px] animate-pulse rounded-sm border border-white bg-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
};
