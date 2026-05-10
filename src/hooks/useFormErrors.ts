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
 *   - On validation failure: focus moves to the first blocking error field
 *     IN DOM REGISTRATION ORDER (not the input `errors` object's key order).
 *   - Entered customer data is RETAINED — addresses, name, contact details survive round-trip.
 *   - Payment-card data MUST NOT persist locally (PCI scope discipline per NFR15).
 *   - Raw API errors / validation codes / stack traces never reach the UI.
 *
 * R6 review fix (second pass): `focusFirstError` now iterates the registered
 * refs Map's insertion order (= DOM order) and looks up each field name in
 * the input `errors` map. The previous implementation iterated the caller's
 * `errors` object keys, which produced wrong focus order for any caller that
 * passed keys in a non-DOM sequence.
 *
 * R14 review fix (second pass): removed misleading
 * `react-hooks/exhaustive-deps` disable comments — the deps array is correct.
 *
 * ARCH-007: Customer-facing storefront only.
 */

import { useCallback, useRef } from 'react';

/** Field error map — keyed by field name. */
export type FieldErrors = Record<string, string | null | undefined>;

export interface UseFormErrorsReturn {
  /**
   * Returns props for a form field. Pass `{ hasError: true }` to surface
   * `aria-invalid` and `aria-describedby`; pass nothing (or `false`) to
   * keep the field clean — F7 review fix: never blanket-claim a clean
   * field is invalid.
   */
  getFieldProps: (
    fieldName: string,
    opts?: { hasError?: boolean },
  ) => {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
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
   *
   * R6 fix: iterates **registered refs in DOM order** (Map insertion order =
   * registration order = DOM order). The first registered field that has a
   * non-null entry in `errors` wins focus. This makes "focus first blocking
   * error" auditable regardless of how the caller orders the `errors` map.
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

  const getFieldProps = useCallback(
    (fieldName: string, opts?: { hasError?: boolean }) => {
      const hasError = opts?.hasError === true;
      const props: {
        id: string;
        'aria-invalid'?: true;
        'aria-describedby'?: string;
      } = { id: `${fieldPrefix}-${fieldName}` };
      if (hasError) {
        props['aria-invalid'] = true;
        props['aria-describedby'] = `${fieldPrefix}-${fieldName}-error`;
      }
      return props;
    },
    [fieldPrefix],
  );

  const getErrorProps = useCallback(
    (fieldName: string) => ({
      id: `${fieldPrefix}-${fieldName}-error`,
      role: 'alert' as const,
    }),
    [fieldPrefix],
  );

  const registerFieldRef = useCallback(
    (fieldName: string) => (el: HTMLElement | null) => {
      fieldRefsRef.current.set(fieldName, el);
    },
    [],
  );

  const focusFirstError = useCallback((errors: FieldErrors) => {
    // R6 fix: iterate registered refs (DOM order) and look up each
    // field name in `errors`. This honours "focus first blocking error"
    // regardless of caller's input key order.
    for (const fieldName of fieldRefsRef.current.keys()) {
      const errorMessage = errors[fieldName];
      if (errorMessage) {
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
