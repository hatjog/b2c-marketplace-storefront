export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const lastIndex = items.length - 1;
  const hasMiddleItems = items.length > 2;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(baseUrl ? { item: `${baseUrl}${item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === lastIndex;
          const isMiddle = !isFirst && !isLast;

          return (
            <li
              key={`breadcrumb-${index}`}
              className={
                isMiddle
                  ? 'hidden sm:inline-flex items-center gap-1'
                  : 'inline-flex items-center gap-1'
              }
            >
              {!isFirst && (
                <span className="mx-1 text-secondary" aria-hidden="true">
                  {'>'}
                </span>
              )}
              {isLast ? (
                <span className="font-semibold text-primary" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="text-secondary hover:underline">
                  {item.label}
                </a>
              )}
            </li>
          );
        })}

        {hasMiddleItems && (
          <li className="sm:hidden inline-flex items-center gap-1" aria-hidden="true">
            <span className="mx-1 text-secondary" aria-hidden="true">
              {'>'}
            </span>
            <span>{'…'}</span>
          </li>
        )}
      </ol>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </nav>
  );
}
