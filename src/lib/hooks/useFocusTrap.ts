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
    if (!container) return;
    const containerEl = container;

    const shouldRestoreTabIndex = !containerEl.hasAttribute('tabindex');
    if (shouldRestoreTabIndex) {
      // Defensive fallback for callers that forget tabIndex={-1}.
      containerEl.setAttribute('tabindex', '-1');
    }

    function isVisibleFocusable(el: HTMLElement): boolean {
      if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      if (el.closest('[aria-hidden="true"]')) {
        return false;
      }
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      // position: fixed often has offsetParent === null, so rely on geometry/style.
      return el.getClientRects().length > 0 || style.position === 'fixed';
    }

    const focusables = Array.from(containerEl.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      isVisibleFocusable
    );
    (focusables[0] ?? containerEl)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(containerEl.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        isVisibleFocusable
      );
      if (items.length === 0) {
        e.preventDefault();
        containerEl.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (!(activeEl instanceof HTMLElement) || !containerEl.contains(activeEl)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
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
      if (shouldRestoreTabIndex) {
        containerEl.removeAttribute('tabindex');
      }
      previouslyFocused.current?.focus?.();
    };
  }, [active, onEscape, lockScroll]);

  return containerRef;
}
