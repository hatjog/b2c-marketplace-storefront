import React from 'react';
import { describe, expect, it } from 'vitest';
import { PriceDisplay } from '../PriceDisplay';

describe('PriceDisplay', () => {
  // AC#2 — null/undefined returns null
  it('returns null when amountInCents is null', () => {
    const result = PriceDisplay({ amountInCents: null });
    expect(result).toBeNull();
  });

  it('returns null when amountInCents is undefined', () => {
    const result = PriceDisplay({ amountInCents: undefined });
    expect(result).toBeNull();
  });

  // AC#3 — zero → "Gratis"
  it('displays "Gratis" when amountInCents is 0', () => {
    const result = PriceDisplay({ amountInCents: 0 }) as React.ReactElement;
    expect(result).not.toBeNull();
    // children[0] is the price text
    const children = React.Children.toArray(result.props.children);
    expect(children[0]).toBe('Gratis');
  });

  // AC#6 — default variant → "200 zł"
  it('renders "200 zł" for default variant with 20000 cents', () => {
    const result = PriceDisplay({ amountInCents: 20000 }) as React.ReactElement;
    const children = React.Children.toArray(result.props.children);
    expect(children[0]).toBe('200 zł');
  });

  // AC#6 — from variant → "od 200 zł"
  it('renders "od 200 zł" for from variant', () => {
    const result = PriceDisplay({
      amountInCents: 20000,
      variant: 'from',
    }) as React.ReactElement;
    const children = React.Children.toArray(result.props.children);
    expect(children[0]).toBe('od 200 zł');
  });

  // AC#6 — range variant (min≠max) → "200–280 zł" (en-dash)
  it('renders "200–280 zł" for range variant with different min/max', () => {
    const result = PriceDisplay({
      amountInCents: 20000,
      maxAmountInCents: 28000,
      variant: 'range',
    }) as React.ReactElement;
    const children = React.Children.toArray(result.props.children);
    expect(children[0]).toBe('200\u2013280 z\u0142');
  });

  // AC#4 — range with equal min/max → fallback to default
  it('falls back to default when range min === max', () => {
    const result = PriceDisplay({
      amountInCents: 20000,
      maxAmountInCents: 20000,
      variant: 'range',
    }) as React.ReactElement;
    const children = React.Children.toArray(result.props.children);
    expect(children[0]).toBe('200 zł');
  });

  // AC#7 — duration with default variant
  it('renders "200 zł · 60 min" for default variant with showDuration', () => {
    const result = PriceDisplay({
      amountInCents: 20000,
      showDuration: true,
      duration: 60,
    }) as React.ReactElement;
    const children = React.Children.toArray(result.props.children);
    expect(children[0]).toBe('200 zł');
    expect(children[1]).toBe(' \u00B7 60 min');
  });

  // AC#7 — duration with from variant
  it('renders "od 200 zł · od 60 min" for from variant with showDuration', () => {
    const result = PriceDisplay({
      amountInCents: 20000,
      variant: 'from',
      showDuration: true,
      duration: 60,
    }) as React.ReactElement;
    const children = React.Children.toArray(result.props.children);
    expect(children[0]).toBe('od 200 zł');
    expect(children[1]).toBe(' \u00B7 od 60 min');
  });

  // AC#5 — showDuration=true but duration=null → no separator
  it('renders no separator when showDuration=true but duration is null', () => {
    const result = PriceDisplay({
      amountInCents: 20000,
      showDuration: true,
      duration: null,
    }) as React.ReactElement;
    const children = React.Children.toArray(result.props.children);
    // Second child should be empty string (no separator)
    expect(children[1]).toBe('');
  });

  // AC#1 — aria-label
  it('has correct aria-label for standard price', () => {
    const result = PriceDisplay({ amountInCents: 20000 }) as React.ReactElement;
    expect(result.props['aria-label']).toBe('Cena: 200 złotych');
  });

  it('has aria-label "Cena: Gratis" when amountInCents is 0', () => {
    const result = PriceDisplay({ amountInCents: 0 }) as React.ReactElement;
    expect(result.props['aria-label']).toBe('Cena: Gratis');
  });

  // Size classes
  it('applies lg size classes for size="lg"', () => {
    const result = PriceDisplay({ amountInCents: 20000, size: 'lg' }) as React.ReactElement;
    expect(result.props.className).toContain('text-2xl');
  });

  it('applies sm size classes for size="sm"', () => {
    const result = PriceDisplay({ amountInCents: 20000, size: 'sm' }) as React.ReactElement;
    expect(result.props.className).toContain('text-sm');
  });
});
