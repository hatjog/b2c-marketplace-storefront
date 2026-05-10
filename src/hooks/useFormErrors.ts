/**
 * useFormErrors — shared form error handling hook.
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Provides consistent aria-describedby linkage and focus-first-error behavior
 * across checkout form steps (address, payment, review).
 *
 * Rules (AC2 / UX-DR17 / UX-DR18):
 *   - Errors are field-linked via aria-describedby.
 *   - On validation failure: focus moves to the first blocking error field.
 *   - Entered customer data is RETAINED — addresses, name, contact details survive round-trip.
 *   - Payment-card data MUST NOT persist locally (PCI scope discipline per NFR15).
 *   - Raw API errors / validation codes / stack traces never reach the UI.
 *
 * ARCH-007: Customer-facing storefront only.
 */

import { useCallback, useRef } from 'react';

/** Field error map — keyed by field name. */
export type FieldErrors = Record<string, string | null | undefined>;

export interface UseFormErrorsReturn {
  /**
   * Returns props for a form field that has an associated error.
   * Spreads aria-describedby and aria-invalid onto the input element.
   */
  getFieldProps: (fieldName: string) => {
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
    id: string;
  };
  /**
   * Returns props for the error message element associated with a field.
   * Spreads id and role onto the error element.
   */
  getErrorProps: (fieldName: string) => {
    id: string;
    role: 'alert';
  };
  /**
   * Focuses the first field with an error. Call after form submission fails.
   * Respects the DOM order of registered refs.
   */
  focusFirstError: (errors: FieldErrors) => void;
  /**
   * Register a field ref for focus management.
   * Returns a ref callback to attach to the field element.
   */
  registerFieldRef: (fieldName: string) => (el: HTMLElement | null) => void;
}

/**
 * useFormErrors — consistent form error handling for checkout steps.
 *
 * @param fieldPrefix - Optional prefix to namespace field IDs (e.g. "address", "payment").
 */
export function useFormErrors(fieldPrefix = 'field'): UseFormErrorsReturn {
  const fieldRefsRef = useRef<Map<string, HTMLElement | null>>(new Map());

  const getFieldId = (fieldName: string) => `${fieldPrefix}-${fieldName}`;
  const getErrorId = (fieldName: string) => `${fieldPrefix}-${fieldName}-error`;

  const getFieldProps = useCallback(
    (fieldName: string) => {
      const errorId = getErrorId(fieldName);
      return {
        id: getFieldId(fieldName),
        'aria-describedby': errorId,
        'aria-invalid': true as const,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldPrefix],
  );

  const getErrorProps = useCallback(
    (fieldName: string) => ({
      id: getErrorId(fieldName),
      role: 'alert' as const,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldPrefix],
  );

  const registerFieldRef = useCallback(
    (fieldName: string) => (el: HTMLElement | null) => {
      fieldRefsRef.current.set(fieldName, el);
    },
    [],
  );

  const focusFirstError = useCallback((errors: FieldErrors) => {
    // Find the first error field that has a mounted ref, in Map insertion order.
    // Map insertion order preserves the registration order (= DOM order).
    for (const [fieldName, error] of Object.entries(errors)) {
      if (error) {
        const el = fieldRefsRef.current.get(fieldName);
        if (el && typeof el.focus === 'function') {
          el.focus({ preventScroll: false });
          return;
        }
      }
    }
  }, []);

  return {
    getFieldProps,
    getErrorProps,
    registerFieldRef,
    focusFirstError,
  };
}
