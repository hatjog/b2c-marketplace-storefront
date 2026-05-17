'use client';

import { useCallback, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type SearchTabId = 'product' | 'salons' | 'voucher';

type SearchTabConfig = {
  id: SearchTabId;
  label: string;
  placeholder: string;
  ariaLabel: string;
};

const TAB_ORDER: SearchTabId[] = ['product', 'salons', 'voucher'];

export function HomeSearchWidget() {
  const t = useTranslations('home_v3.search');
  const router = useRouter();

  const tabs: SearchTabConfig[] = useMemo(
    () => [
      {
        id: 'product',
        label: t('tabs.product'),
        placeholder: t('placeholders.product'),
        ariaLabel: t('aria.product_input'),
      },
      {
        id: 'salons',
        label: t('tabs.salons'),
        placeholder: t('placeholders.salons'),
        ariaLabel: t('aria.salons_input'),
      },
      {
        id: 'voucher',
        label: t('tabs.voucher'),
        placeholder: t('placeholders.voucher'),
        ariaLabel: t('aria.voucher_input'),
      },
    ],
    [t]
  );

  const [activeTab, setActiveTab] = useState<SearchTabId>('product');
  const [values, setValues] = useState<Record<SearchTabId, string>>({
    product: '',
    salons: '',
    voucher: '',
  });

  const onTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return;
      }

      event.preventDefault();
      let nextIndex = currentIndex;

      if (event.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % TAB_ORDER.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = TAB_ORDER.length - 1;
      }

      const nextTab = TAB_ORDER[nextIndex];
      setActiveTab(nextTab);
      const tabElement = document.getElementById(`home-search-tab-${nextTab}`);
      tabElement?.focus();
    },
    []
  );

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const value = values[activeTab]?.trim() ?? '';

      if (activeTab === 'product') {
        const params = new URLSearchParams();
        if (value.length > 0) {
          params.set('query', value);
        }
        const query = params.toString();
        router.push(query ? `/categories?${query}` : '/categories');
        return;
      }

      if (activeTab === 'salons') {
        const params = new URLSearchParams();
        if (value.length > 0) {
          params.set('q', value);
        }
        const query = params.toString();
        router.push(query ? `/sellers?${query}` : '/sellers');
        return;
      }

      const params = new URLSearchParams();
      params.set('mode', 'gift');
      if (value.length > 0) {
        params.set('query', value);
      }
      router.push(`/categories?${params.toString()}`);
    },
    [activeTab, router, values]
  );

  const activeConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div
      className="rounded-[20px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-3 shadow-[var(--bb-shadow-soft)] md:p-4"
      data-testid="home-search-widget"
    >
      <div
        role="tablist"
        aria-label={t('aria.tablist')}
        className="mb-3 flex flex-wrap gap-2"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`home-search-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`home-search-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={clsx(
                'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
                selected
                  ? 'border-[var(--cta)] bg-[var(--gold-light)] text-primary'
                  : 'border-[var(--bb-border-soft)] bg-transparent text-secondary hover:text-primary'
              )}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={submit}
        role="search"
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div
          id={`home-search-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`home-search-tab-${activeTab}`}
          className="flex-1"
        >
          <label
            htmlFor="home-search-input"
            className="sr-only"
          >
            {activeConfig.ariaLabel}
          </label>
          <input
            id="home-search-input"
            type={activeTab === 'voucher' ? 'number' : 'search'}
            min={activeTab === 'voucher' ? 0 : undefined}
            inputMode={activeTab === 'voucher' ? 'numeric' : 'search'}
            value={values[activeTab]}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                [activeTab]: event.target.value,
              }))
            }
            placeholder={activeConfig.placeholder}
            className="min-h-[48px] w-full rounded-[14px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-strong)] px-4 text-sm text-primary outline-none transition-shadow placeholder:text-secondary focus:shadow-[0_0_0_2px_var(--accent)]"
          />
        </div>

        <button
          type="submit"
          className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[var(--bg-action)] px-6 text-sm font-semibold text-[var(--text-on-action)] transition-colors hover:bg-[var(--bg-action-hover)]"
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}
