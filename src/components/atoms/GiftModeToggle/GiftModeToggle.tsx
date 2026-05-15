'use client';

// GiftModeToggle — client-side toggle for gift/self purchase mode on PDP.
// DS v2.1.0: cta, bg-action, text-on-action tokens.

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface GiftModeToggleProps {
  defaultMode?: 'gift' | 'self';
  onModeChange?: (mode: 'gift' | 'self') => void;
  className?: string;
}

export function GiftModeToggle({
  defaultMode = 'self',
  onModeChange,
  className,
}: GiftModeToggleProps) {
  const [mode, setMode] = useState<'gift' | 'self'>(defaultMode);

  function handleSelect(next: 'gift' | 'self') {
    setMode(next);
    onModeChange?.(next);
  }

  return (
    <div
      className={cn(
        'inline-flex rounded-[var(--bb-radius-pill)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-muted)] p-0.5',
        className
      )}
      role="group"
      aria-label="Tryb zakupu"
      data-testid="gift-mode-toggle"
    >
      {(['self', 'gift'] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => handleSelect(m)}
            aria-pressed={active}
            className={cn(
              'rounded-[var(--bb-radius-pill)] px-4 py-1.5 text-sm font-medium transition-colors duration-[var(--anim-duration-fast)]',
              active
                ? 'bg-[var(--bg-action)] text-[var(--text-on-action)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {m === 'gift' ? '🎁 Prezent' : 'Dla siebie'}
          </button>
        );
      })}
    </div>
  );
}
