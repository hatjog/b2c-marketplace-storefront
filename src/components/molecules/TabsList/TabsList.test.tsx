// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { TabsList } from './TabsList';

vi.mock('@/components/molecules/LocalizedLink/LocalizedLink', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

describe('TabsList', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('moves DOM focus with ArrowRight, ArrowLeft, Home and End', async () => {
    await act(async () => {
      root.render(
        <TabsList
          activeTab="products"
          idBase="seller-tabs"
          list={[
            { label: 'Products', link: '/sellers/test', value: 'products' },
            { label: 'Reviews', link: '/sellers/test/reviews', value: 'reviews' },
            { label: 'About', link: '/sellers/test/about', value: 'about' }
          ]}
        />
      );
    });

    const tabs = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[role="tab"]'));
    expect(tabs).toHaveLength(3);

    tabs[0]?.focus();
    expect(document.activeElement).toBe(tabs[0]);

    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs[1]);

    tabs[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs[2]);

    tabs[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(tabs[0]);

    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(tabs[2]);

    tabs[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(tabs[1]);
  });
});
