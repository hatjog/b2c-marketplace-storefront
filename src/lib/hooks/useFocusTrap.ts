'use client';

// Wave 6 chrome a11y helper (Story 3.1) — focus trap + ESC + scroll lock.
// Shared przez W6-04 cookie sub-modal / W6-05 modal shell / W6-08 mini-cart
// drawer / W6-09 search overlay. Zwraca focus do triggera po zamknięciu.

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  active: boolean;
  onEscape?: () => void;
  /** Lock body scroll while trap active (modals/drawers/overlays). */
  lockScroll?: boolean;
}

/**
 * Traps Tab focus within the returned ref'd container while `active`.
 * - ESC → `onEscape`
 * - restores focus to the element focused before activation
 * - optional body scroll lock
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  active,
  onEscape,
  lockScroll = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;

    const focusables = container
      ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      : [];
    (focusables[0] ?? container)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    let prevOverflow = '';
    if (lockScroll) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (lockScroll) {
        document.body.style.overflow = prevOverflow;
      }
      previouslyFocused.current?.focus?.();
    };
  }, [active, onEscape, lockScroll]);

  return containerRef;
}
