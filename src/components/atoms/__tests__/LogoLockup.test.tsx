import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { LogoLockup, MONOGRAM_SRC } from '../LogoLockup/LogoLockup';

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
    const [image, wordmark] = React.Children.toArray(rendered.props.children) as ReactEl[];

    expect(image.props.src).toBe(MONOGRAM_SRC.dark);
    expect(image.props.alt).toBe('');
    expect(image.props['aria-hidden']).toBe('true');
    expect(wordmark.props.children).toBe('BonBeauty');
    expect(wordmark.props.style).toEqual({ fontFamily: 'var(--font-wordmark)' });
  });

  it('uses light monogram variant for dark surfaces', () => {
    const rendered = renderLogoLockup({ variant: 'light' });
    const [image] = React.Children.toArray(rendered.props.children) as ReactEl[];

    expect(image.props.src).toBe(MONOGRAM_SRC.light);
  });

  it('falls back to the monogram when configured logo is unavailable', () => {
    const rendered = renderLogoLockup({ logoSrc: null });
    const [image] = React.Children.toArray(rendered.props.children) as ReactEl[];

    expect(image.props.src).toBe(MONOGRAM_SRC.dark);
    expect(String(rendered.props.children)).not.toContain('marketName');
  });

  it('uses configured logo asset without changing the BonBeauty wordmark', () => {
    const rendered = renderLogoLockup({ logoSrc: '/configured-logo.svg' });
    const [image, wordmark] = React.Children.toArray(rendered.props.children) as ReactEl[];

    expect(image.props.src).toBe('/configured-logo.svg');
    expect(wordmark.props.children).toBe('BonBeauty');
  });
});
