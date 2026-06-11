'use client';

import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import type { TocEntry } from '@/types/blog';

type BlogTocNavProps = {
  label: string;
  entries: TocEntry[];
  mobileLabel: string;
};

export function BlogTocNav({ label, entries, mobileLabel }: BlogTocNavProps) {
  const entryIds = useMemo(() => entries.map(entry => entry.id), [entries]);
  const [activeId, setActiveId] = useState(entries[0]?.id ?? '');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (entries.length === 0) {
      return;
    }

    setActiveId(entries[0]?.id ?? '');

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const headings = entryIds
      .map(id => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (headings.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      observed => {
        const visible = observed
          .filter(entry => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];

        if (visible?.target?.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0.1, 0.4, 0.8]
      }
    );

    headings.forEach(heading => observer.observe(heading));

    return () => observer.disconnect();
  }, [entries, entryIds]);

  const nav = (
    <nav
      aria-label={label}
      className="space-y-2"
      data-testid="blog-toc-nav"
    >
      {entries.map(entry => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          aria-current={activeId === entry.id ? 'true' : undefined}
          className={cn(
            'block rounded-full px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)]',
            entry.level === 3 && 'ml-3',
            entry.level === 4 && 'ml-6',
            activeId === entry.id
              ? 'bg-[var(--bb-tint-gold-12)] text-primary'
              : 'text-secondary hover:text-primary'
          )}
          onClick={() => setMobileOpen(false)}
        >
          {entry.label}
        </a>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="sticky top-24 hidden w-full max-w-[240px] self-start rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-white-75)] p-4 md:block">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-secondary">
          {label}
        </p>
        {nav}
      </aside>

      <div className="space-y-3 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-white/80 p-4 md:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          aria-expanded={mobileOpen}
          aria-controls="blog-toc-mobile-panel"
          onClick={() => setMobileOpen(open => !open)}
        >
          <span className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">
            {mobileLabel}
          </span>
          <span className="text-xs text-secondary">{mobileOpen ? '−' : '+'}</span>
        </button>
        {mobileOpen ? (
          <div
            id="blog-toc-mobile-panel"
            className="border-t border-[var(--bb-border-soft)] pt-3"
          >
            {nav}
          </div>
        ) : null}
      </div>
    </>
  );
}
