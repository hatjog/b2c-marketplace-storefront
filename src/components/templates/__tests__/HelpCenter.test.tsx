import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { HelpCenter } from '../HelpCenter';

vi.mock('@/components/molecules/LocalizedLink/LocalizedLink', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, ...props }, children),
}));

describe('HelpCenter', () => {
  let dom: JSDOM;
  let container: HTMLDivElement;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/pl/pomoc' });
    container = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(container);
    globalThis.window = dom.window as unknown as typeof window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.Event = dom.window.Event as unknown as typeof Event;
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  function render() {
    const root = createRoot(container);
    act(() => {
      root.render(
        <HelpCenter
          eyebrow="Help"
          title="Calm help"
          description="Description"
          searchLabel="Search"
          searchPlaceholder="Type here"
          noResultsLabel="No results"
          topicsTitle="Topics"
          trustCardTitle="Contact"
          trustCardBody="Body"
          trustCardPrimaryLabel="Primary"
          trustCardPrimaryHref="/pomoc?contact=async"
          trustCardSecondaryLabel="Secondary"
          trustCardSecondaryHref="/regulamin"
          relatedLinksTitle="Links"
          relatedLinks={[{ id: 'terms', label: 'Terms', href: '/regulamin' }]}
          sourceMarker="static-preprod-fallback"
          topics={[
            {
              id: 'orders',
              title: 'Orders',
              description: 'About orders',
              entries: [
                { id: '1', question: 'Where is my order?', answer: 'In your email.' },
                { id: '2', question: 'How long does payment take?', answer: 'Usually a few minutes.' },
              ],
            },
          ]}
        />
      );
    });
  }

  it('toggles accordion buttons with aria-expanded', () => {
    render();
    const button = container.querySelector('button[aria-controls="orders:1-panel"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('true');

    act(() => {
      button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('exposes the typed source marker on the root surface', () => {
    render();
    const main = container.querySelector('[data-testid="help-page"]');
    expect(main?.getAttribute('data-help-source')).toBe('static-preprod-fallback');
  });
});
