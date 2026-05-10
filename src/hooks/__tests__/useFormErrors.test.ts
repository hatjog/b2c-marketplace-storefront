/**
 * Tests for useFormErrors — R6 review fix (second pass).
 *
 * The hook itself uses only `useRef` + `useCallback`, both safe to mock as
 * plain identity functions. This lets us test the core algorithm
 * (focusFirstError respecting DOM-registration order, getFieldProps
 * opt-in aria-invalid) without rendering.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock React's useRef + useCallback to be identity-like so the hook can run
// outside a renderer.
vi.mock('react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react');
  return {
    ...actual,
    useRef: <T>(initial: T) => ({ current: initial }),
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

import { useFormErrors } from '../useFormErrors';

describe('useFormErrors', () => {
  describe('getFieldProps', () => {
    it('returns only id when hasError is false / omitted', () => {
      const { getFieldProps } = useFormErrors('test');
      const props = getFieldProps('email');
      expect(props.id).toBe('test-email');
      expect(props['aria-invalid']).toBeUndefined();
      expect(props['aria-describedby']).toBeUndefined();
    });

    it('returns aria-invalid + aria-describedby when hasError is true', () => {
      const { getFieldProps } = useFormErrors('test');
      const props = getFieldProps('email', { hasError: true });
      expect(props.id).toBe('test-email');
      expect(props['aria-invalid']).toBe(true);
      expect(props['aria-describedby']).toBe('test-email-error');
    });

    it('respects fieldPrefix', () => {
      const { getFieldProps } = useFormErrors('address');
      expect(getFieldProps('postal').id).toBe('address-postal');
    });
  });

  describe('getErrorProps', () => {
    it('returns id matching getFieldProps and role=alert', () => {
      const { getErrorProps } = useFormErrors('test');
      const props = getErrorProps('email');
      expect(props.id).toBe('test-email-error');
      expect(props.role).toBe('alert');
    });
  });

  describe('focusFirstError — R6 DOM-registration-order contract', () => {
    function makeEl(): HTMLElement {
      const el = { focus: vi.fn() } as unknown as HTMLElement;
      return el;
    }

    it('focuses the first registered field that has an error (DOM order)', () => {
      const { registerFieldRef, focusFirstError } = useFormErrors('test');
      const a = makeEl();
      const b = makeEl();
      const c = makeEl();
      registerFieldRef('first')(a);
      registerFieldRef('second')(b);
      registerFieldRef('third')(c);

      focusFirstError({ first: 'err', third: 'err' });

      expect((a.focus as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect((b.focus as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      expect((c.focus as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });

    it('R6: ignores caller-supplied errors key order — DOM order wins', () => {
      const { registerFieldRef, focusFirstError } = useFormErrors('test');
      const a = makeEl();
      const b = makeEl();
      registerFieldRef('alpha')(a);
      registerFieldRef('beta')(b);

      // Caller passes errors with `beta` listed first — but DOM has `alpha`
      // first, so focus must land on `alpha`.
      focusFirstError({ beta: 'err', alpha: 'err' });

      expect((a.focus as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect((b.focus as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });

    it('skips fields without an error entry', () => {
      const { registerFieldRef, focusFirstError } = useFormErrors('test');
      const a = makeEl();
      const b = makeEl();
      registerFieldRef('alpha')(a);
      registerFieldRef('beta')(b);

      focusFirstError({ alpha: null, beta: 'err' });

      expect((a.focus as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      expect((b.focus as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    });

    it('does nothing when all errors are null', () => {
      const { registerFieldRef, focusFirstError } = useFormErrors('test');
      const a = makeEl();
      registerFieldRef('alpha')(a);

      focusFirstError({ alpha: null });

      expect((a.focus as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });
  });
});
