'use server';

import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/routing';
import {
  forgotPasswordSchema,
  inlineRegisterSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from '@/lib/auth/schemas';
import { login, sendResetPasswordEmail, signup, updateCustomerPassword } from '@/lib/data/customer';

export type AuthActionState = {
  status: 'idle' | 'error' | 'success';
  formError?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
  successMessage?: string;
  submittedEmail?: string;
  cooldownUntil?: number;
};

export const INITIAL_AUTH_ACTION_STATE: AuthActionState = {
  status: 'idle'
};

const safeLocale = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string') {
    return DEFAULT_LOCALE;
  }

  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
};

const formDataToObject = (formData: FormData) => ({
  locale: formData.get('locale')?.toString(),
  token: formData.get('token')?.toString(),
  email: formData.get('email')?.toString() ?? '',
  password: formData.get('password')?.toString() ?? '',
  confirmPassword: formData.get('confirmPassword')?.toString() ?? '',
  firstName: formData.get('firstName')?.toString() ?? '',
  rememberMe: formData.get('rememberMe') === 'on',
  termsConsent: formData.get('termsConsent') === 'on',
  privacyConsent: formData.get('privacyConsent') === 'on',
  rodoConsent: formData.get('rodoConsent') === 'on',
  marketingConsent: formData.get('marketingConsent') === 'on'
});

const mapZodErrors = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  issues.reduce<Record<string, string>>((acc, issue) => {
    const field = issue.path[0];
    if (typeof field === 'string' && !acc[field]) {
      acc[field] = issue.message;
    }
    return acc;
  }, {});

const isCredentialError = (message: string) =>
  /invalid email or password|unauthorized|incorrect|credentials/i.test(message);

const isDuplicateEmailError = (message: string) =>
  /identity with email already exists|already exists/i.test(message);

export async function loginWithEmailPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const locale = safeLocale(formData.get('locale'));
  const parsed = loginSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: mapZodErrors(parsed.error.issues)
    };
  }

  const nextFormData = new FormData();
  nextFormData.set('email', parsed.data.email);
  nextFormData.set('password', parsed.data.password);
  const result = await login(nextFormData);

  if (typeof result === 'string' && result.length > 0) {
    return {
      status: 'error',
      formError: isCredentialError(result) ? 'auth.login.invalid_credentials' : 'auth.common.error'
    };
  }

  return {
    status: 'success',
    redirectTo: `/${locale}/user`,
    successMessage: 'auth.login.success'
  };
}

export async function registerCustomer(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const locale = safeLocale(formData.get('locale'));
  const parsed = registerSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: mapZodErrors(parsed.error.issues)
    };
  }

  const nextFormData = new FormData();
  nextFormData.set('email', parsed.data.email);
  nextFormData.set('password', parsed.data.password);
  nextFormData.set('first_name', parsed.data.firstName);
  nextFormData.set('last_name', '');
  nextFormData.set('phone', '');

  const result = await signup(nextFormData);

  if (!result || typeof result === 'string') {
    return {
      status: 'error',
      formError:
        typeof result === 'string' && isDuplicateEmailError(result)
          ? 'auth.register.email_exists'
          : 'auth.common.error'
    };
  }

  return {
    status: 'success',
    redirectTo: `/${locale}/user`,
    successMessage: 'auth.register.success'
  };
}

export async function sendForgotPasswordRequest(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: mapZodErrors(parsed.error.issues)
    };
  }

  try {
    await sendResetPasswordEmail(parsed.data.email);
  } catch {
    // Anti-enumeration: UI always moves to the same neutral success state.
  }

  return {
    status: 'success',
    successMessage: 'auth.forgot.success_title',
    submittedEmail: parsed.data.email,
    cooldownUntil: Date.now() + 60_000
  };
}

export async function resetPasswordWithToken(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const locale = safeLocale(formData.get('locale'));
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: 'error',
      formError: parsed.error.issues.some(issue => issue.message === 'auth.reset.invalid_token')
        ? 'auth.reset.invalid_token'
        : undefined,
      fieldErrors: mapZodErrors(
        parsed.error.issues.filter(issue => issue.message !== 'auth.reset.invalid_token')
      )
    };
  }

  const result = await updateCustomerPassword(parsed.data.password, parsed.data.token);

  if (!result?.success) {
    return {
      status: 'error',
      formError: 'auth.reset.invalid_token'
    };
  }

  return {
    status: 'success',
    redirectTo: `/${locale}/login`,
    successMessage: 'auth.reset.success_title'
  };
}

export async function registerInlineCustomer(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const locale = safeLocale(formData.get('locale'));
  const parsed = inlineRegisterSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: mapZodErrors(parsed.error.issues)
    };
  }

  const nextFormData = new FormData();
  nextFormData.set('email', parsed.data.email);
  nextFormData.set('password', parsed.data.password);
  nextFormData.set('first_name', '');
  nextFormData.set('last_name', '');
  nextFormData.set('phone', '');

  const result = await signup(nextFormData);

  if (!result || typeof result === 'string') {
    return {
      status: 'error',
      formError:
        typeof result === 'string' && isDuplicateEmailError(result)
          ? 'auth.register.email_exists'
          : 'auth.common.error'
    };
  }

  return {
    status: 'success',
    redirectTo: `/${locale}/user`,
    successMessage: 'auth.inline.success'
  };
}
