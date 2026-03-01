export const SkeletonProductCard = () => {
  return (
    <div
      className="group relative flex h-[338px] w-full min-w-[250px] animate-pulse flex-col justify-between rounded-sm border bg-gray-200 p-1 lg:w-[calc(25%-1rem)]"
      data-testid="skeleton-product-card"
    />
  );
};
