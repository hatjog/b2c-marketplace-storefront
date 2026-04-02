export function paginateSortedProducts<T>(products: T[], page = 1, limit?: number) {
  if (limit == null) {
    return {
      products,
      nextPage: null as number | null
    };
  }

  const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : undefined;

  if (normalizedLimit == null) {
    return {
      products,
      nextPage: null as number | null
    };
  }

  const start = (normalizedPage - 1) * normalizedLimit;
  const end = start + normalizedLimit;
  const paginatedProducts = products.slice(start, end);
  const nextPage = end < products.length ? normalizedPage + 1 : null;

  return {
    products: paginatedProducts,
    nextPage
  };
}