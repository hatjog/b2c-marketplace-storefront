'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { SORT_OPTIONS, type SortOption } from '@/lib/constants';

export function SortDropdown() {
  const t = useTranslations('sort');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get('sort');
  const currentSort: SortOption = SORT_OPTIONS.includes(raw as SortOption)
    ? (raw as SortOption)
    : 'recommended';

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  function selectSort(value: SortOption) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    router.push(pathname + '?' + params.toString());
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(prev => {
        if (!prev) {
          setFocusedIndex(0);
          setTimeout(() => optionRefs.current[0]?.focus(), 0);
        }
        return !prev;
      });
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleOptionKeyDown(e: React.KeyboardEvent<HTMLLIElement>, index: number, value: SortOption) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectSort(value);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % SORT_OPTIONS.length;
      setFocusedIndex(next);
      optionRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length;
      setFocusedIndex(prev);
      optionRefs.current[prev]?.focus();
    } else if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const SORT_LABELS: Record<SortOption, string> = {
    recommended: t('recommended'),
    price_asc: t('price_asc'),
    price_desc: t('price_desc'),
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className="flex items-center gap-1 rounded border border-[var(--border-action)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
        data-testid="sort-dropdown-trigger"
      >
        <span>{t('label')}: {SORT_LABELS[currentSort]}</span>
        <span aria-hidden="true" className="ml-1 text-[var(--text-secondary)]">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('aria_label')}
          className="absolute right-0 z-10 mt-1 min-w-[140px] rounded border border-[var(--border-action)] bg-white shadow-md"
          data-testid="sort-dropdown-menu"
        >
          {SORT_OPTIONS.map((option, index) => (
            <li
              key={option}
              ref={el => { optionRefs.current[index] = el; }}
              role="option"
              aria-selected={currentSort === option}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => selectSort(option)}
              onKeyDown={e => handleOptionKeyDown(e, index, option)}
              className={`cursor-pointer px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] ${
                currentSort === option ? 'font-semibold' : ''
              }`}
              data-testid={`sort-option-${option}`}
            >
              {SORT_LABELS[option]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
