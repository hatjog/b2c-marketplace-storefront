'use client';

import { useRef } from 'react';

import { TabsTrigger } from '@/components/atoms/TabsTrigger/TabsTrigger';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

function getNextIndex(currentIndex: number, key: string, total: number): number {
  if (key === 'ArrowRight') return (currentIndex + 1) % total;
  if (key === 'ArrowLeft') return (currentIndex - 1 + total) % total;
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  return currentIndex;
}

export const TabsList = ({
  list,
  activeTab,
  idBase = 'tabs',
  'data-testid': dataTestId
}: {
  list: { label: string; link: string; value?: string }[];
  activeTab: string;
  idBase?: string;
  'data-testid'?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-orientation="horizontal"
      className="flex w-full gap-4"
      data-testid={dataTestId ?? 'tabs-list'}
    >
      {list.map(({ label, link, value }, index) => {
        const tabValue = value ?? label.toLowerCase();
        const isActive = activeTab === tabValue;

        return (
        <LocalizedClientLink
          key={tabValue}
          href={link}
          role="tab"
          id={`${idBase}-${tabValue}-tab`}
          aria-selected={isActive}
          aria-controls={`${idBase}-${tabValue}-panel`}
          tabIndex={isActive ? 0 : -1}
          data-tab-link="true"
          onKeyDown={(event: React.KeyboardEvent<HTMLAnchorElement>) => {
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
              return;
            }

            const tabLinks = Array.from(
              containerRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-tab-link="true"]') ?? []
            );
            if (tabLinks.length === 0) return;

            event.preventDefault();
            const nextIndex = getNextIndex(index, event.key, tabLinks.length);
            tabLinks[nextIndex]?.focus();
          }}
        >
          <TabsTrigger isActive={isActive}>{label}</TabsTrigger>
        </LocalizedClientLink>
        );
      })}
    </div>
  );
};
