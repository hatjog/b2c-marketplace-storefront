import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogin = vi.fn();
const mockSendResetPasswordEmail = vi.fn();
const mockSignup = vi.fn();
const mockUpdateCustomerPassword = vi.fn();

vi.mock('@/lib/data/customer', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  sendResetPasswordEmail: (...args: unknown[]) => mockSendResetPasswordEmail(...args),
  signup: (...args: unknown[]) => mockSignup(...args),
  updateCustomerPassword: (...args: unknown[]) => mockUpdateCustomerPassword(...args)
}));

function makeFormData(fields: Record<string, string | boolean>): FormData {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value === true) {
      formData.set(key, 'on');
      return;
    }

    if (value === false) {
      return;
    }

    formData.set(key, value);
  });

  return formData;
}

describe('auth Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loginWithEmailPassword maps credential errors to calm auth copy', async () => {
    mockLogin.mockResolvedValue('Invalid email or password');
    const { loginWithEmailPassword, INITIAL_AUTH_ACTION_STATE } = await import('../auth');

    const result = await loginWithEmailPassword(
      INITIAL_AUTH_ACTION_STATE,
      makeFormData({
        locale: 'pl',
        email: 'anna@example.com',
        password: 'Password!2'
      })
    );

    expect(result.status).toBe('error');
    expect(result.formError).toBe('auth.login.invalid_credentials');
  });

  it('registerCustomer returns field errors from zod keys', async () => {
    const { registerCustomer, INITIAL_AUTH_ACTION_STATE } = await import('../auth');

    const result = await registerCustomer(
      INITIAL_AUTH_ACTION_STATE,
      makeFormData({
        locale: 'pl',
        firstName: '',
        email: 'not-an-email',
        password: 'abc',
        confirmPassword: 'xyz',
        termsConsent: false,
        privacyConsent: false,
        rodoConsent: false
      })
    );

    expect(result.status).toBe('error');
    expect(result.fieldErrors?.firstName).toBe('validation.first_name_required');
    expect(result.fieldErrors?.email).toBe('validation.email_invalid');
    expect(result.fieldErrors?.confirmPassword).toBe('validation.password_mismatch');
  });

  it('sendForgotPasswordRequest always returns neutral success state', async () => {
    mockSendResetPasswordEmail.mockRejectedValue(new Error('backend unavailable'));
    const { sendForgotPasswordRequest, INITIAL_AUTH_ACTION_STATE } = await import('../auth');

    const result = await sendForgotPasswordRequest(
      INITIAL_AUTH_ACTION_STATE,
      makeFormData({
        locale: 'pl',
        email: 'anna@example.com'
      })
    );

    expect(result.status).toBe('success');
    expect(result.submittedEmail).toBe('anna@example.com');
    expect(result.cooldownUntil).toBeTypeOf('number');
  });

  it('resetPasswordWithToken returns neutral invalid-token state when backend rejects token', async () => {
    mockUpdateCustomerPassword.mockResolvedValue({ success: false, error: 'expired' });
    const { resetPasswordWithToken, INITIAL_AUTH_ACTION_STATE } = await import('../auth');

    const result = await resetPasswordWithToken(
      INITIAL_AUTH_ACTION_STATE,
      makeFormData({
        locale: 'pl',
        token: 'bad-token',
        password: 'Password!2',
        confirmPassword: 'Password!2'
      })
    );

    expect(result.status).toBe('error');
    expect(result.formError).toBe('auth.reset.invalid_token');
  });

  it('registerInlineCustomer redirects to localized account route on success', async () => {
    mockSignup.mockResolvedValue({ id: 'cus_123' });
    const { registerInlineCustomer, INITIAL_AUTH_ACTION_STATE } = await import('../auth');

    const result = await registerInlineCustomer(
      INITIAL_AUTH_ACTION_STATE,
      makeFormData({
        locale: 'de',
        email: 'anna@example.com',
        password: 'Password!2',
        confirmPassword: 'Password!2',
        termsConsent: true
      })
    );

    expect(result.status).toBe('success');
    expect(result.redirectTo).toBe('/de/user');
  });
});
