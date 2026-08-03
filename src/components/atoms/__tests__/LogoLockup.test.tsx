import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LogoLockup, MONOGRAM_SRC } from '../LogoLockup/LogoLockup';

// Stub LocalizedClientLink so renderToStaticMarkup works without intl context
vi.mock('@/components/molecules/LocalizedLink/LocalizedLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children),
}));

type ReactEl = React.ReactElement<Record<string, unknown>>;

function renderLogoLockup(props: Parameters<typeof LogoLockup>[0] = {}) {
  return (LogoLockup as unknown as (p: unknown) => ReactEl)(props);
}

describe('LogoLockup', () => {
  it('renders a home link with BonBeauty aria label', () => {
    const rendered = renderLogoLockup();

    expect(rendered.props.href).toBe('/');
    expect(rendered.props['aria-label']).toBe('BonBeauty');
    expect(String(rendered.props.className)).toContain('inline-flex');
  });

  it('renders monogram and BonBeauty wordmark in the wordmark font token', () => {
    const rendered = renderLogoLockup();
    const [image, wordmark] = React.Children.toArray(rendered.props.children as React.ReactNode) as ReactEl[];

    expect(image.props.src).toBe(MONOGRAM_SRC.dark);
    expect(image.props.alt).toBe('');
    expect(image.props['aria-hidden']).toBe('true');
    expect(wordmark.props.children).toBe('BonBeauty');
    expect(wordmark.props.style).toEqual({ fontFamily: 'var(--font-wordmark)' });
  });

  it('renders home <a> link and BonBeauty text in DOM output (monogram path)', () => {
    const html = renderToStaticMarkup(React.createElement(LogoLockup));

    expect(html).toContain('<a ');
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="BonBeauty"');
    expect(html).toContain('<img');
    expect(html).toContain('BonBeauty');
  });

  it('uses light monogram variant for dark surfaces', () => {
    const rendered = renderLogoLockup({ variant: 'light' });
    const [image] = React.Children.toArray(rendered.props.children as React.ReactNode) as ReactEl[];

    expect(image.props.src).toBe(MONOGRAM_SRC.light);
  });

  it('falls back to the monogram when configured logo is unavailable', () => {
    const rendered = renderLogoLockup({ logoSrc: null });
    const [image] = React.Children.toArray(rendered.props.children as React.ReactNode) as ReactEl[];

    expect(image.props.src).toBe(MONOGRAM_SRC.dark);
    expect(String(rendered.props.children)).not.toContain('marketName');
  });

  it('uses configured logo asset and hides wordmark (non-BonBeauty market path)', () => {
    const html = renderToStaticMarkup(
      React.createElement(LogoLockup, { logoSrc: '/configured-logo.svg' })
    );

    expect(html).toContain('src="/configured-logo.svg"');
    // Wordmark must not appear for configured (non-BonBeauty) logo — L-1 fix
    expect(html).not.toContain('>BonBeauty<');
    // Home link and a11y label preserved
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="BonBeauty"');
  });
});
