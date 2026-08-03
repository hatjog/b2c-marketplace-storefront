import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { buildTechnicalDetails, resolveRuntimeErrorVariant } from '@/lib/wave5/error-surface';

import { ErrorSurface } from '../ErrorSurface';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function render(props: Parameters<typeof ErrorSurface>[0]) {
  return (ErrorSurface as unknown as (value: typeof props) => ReactEl)(props);
}

function findByType(node: React.ReactNode, type: string): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null;
  const el = node as ReactEl;
  if (el.type === type) return el;
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  for (const child of children) {
    const found = findByType(child, type);
    if (found) return found;
  }
  return null;
}

function collectText(node: React.ReactNode, acc: string[] = []): string[] {
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => collectText(entry, acc));
    return acc;
  }
  if (React.isValidElement<Record<string, unknown>>(node)) {
    collectText(node.props.children as React.ReactNode, acc);
  }
  return acc;
}

describe('ErrorSurface', () => {
  it('renders title, CTA and technical details disclosure', () => {
    const root = render({
      title: 'Tej strony tu nie ma',
      description: 'Empathic body',
      primaryAction: <button type="button">Home</button>,
      technicalDetailsLabel: 'Pokaż szczegóły techniczne',
      technicalDetails: {
        requestId: 'req-123',
        timestampIso: '2026-05-18T12:00:00.000Z',
        suggestedAction: 'Refresh',
        labels: {
          requestId: 'Identyfikator żądania',
          timestamp: 'Znacznik czasu',
          suggestedAction: 'Sugerowane działanie',
        },
      },
    });

    expect(collectText(root).join(' ')).toContain('Tej strony tu nie ma');
    expect(collectText(root).join(' ')).toContain('Pokaż szczegóły techniczne');
    const summary = findByType(root, 'summary');
    expect(summary).not.toBeNull();
  });

  it('resolves 503 and offline variants correctly', () => {
    expect(resolveRuntimeErrorVariant(new Error('503 Service Unavailable'))).toBe('service-unavailable');
    expect(resolveRuntimeErrorVariant(new Error('anything'), { offline: true })).toBe('offline');
  });

  it('builds copy-friendly technical details payloads', () => {
    const payload = buildTechnicalDetails({ digest: 'abc-123' }, 'Retry later', new Date('2026-05-18T12:00:00.000Z'));
    expect(payload.requestId).toBe('abc-123');
    expect(payload.timestampIso).toBe('2026-05-18T12:00:00.000Z');
    expect(payload.suggestedAction).toBe('Retry later');
  });
});
