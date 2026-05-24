'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { EyeMini, EyeSlashMini } from '@medusajs/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm, type DefaultValues, type FieldErrors, type FieldPath } from 'react-hook-form';

import {
  INITIAL_AUTH_ACTION_STATE,
  loginWithEmailPassword,
  registerCustomer,
  registerInlineCustomer,
  resetPasswordWithToken,
  sendForgotPasswordRequest,
  type AuthActionState
} from '@/actions/auth';
import { Button } from '@/components/atoms';
import { Checkbox } from '@/components/atoms/Checkbox/Checkbox';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { useFormErrors } from '@/hooks/useFormErrors';
import {
  forgotPasswordSchema,
  inlineRegisterSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type InlineRegisterValues,
  type LoginValues,
  type RegisterValues,
  type ResetPasswordValues
} from '@/lib/auth/schemas';
import { cn } from '@/lib/utils';

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

const translateKey = (
  key: string | undefined,
  tAuth: TranslationFn,
  tValidation: TranslationFn
) => {
  if (!key) {
    return '';
  }

  if (key.startsWith('validation.')) {
    return tValidation(key.replace('validation.', ''));
  }

  if (key.startsWith('auth.')) {
    return tAuth(key.replace('auth.', ''));
  }

  return key;
};

const buildFieldErrorMap = <T extends Record<string, unknown>>(
  errors: FieldErrors<T>,
  tAuth: TranslationFn,
  tValidation: TranslationFn
) =>
  Object.entries(errors).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value?.message && typeof value.message === 'string') {
      acc[key] = translateKey(value.message, tAuth, tValidation);
    }
    return acc;
  }, {});

function useActionForm<TValues extends Record<string, unknown>>({
  schema,
  initialValues,
  action
}: {
  schema: any;
  initialValues: TValues;
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
}) {
  const tAuth = useTranslations('auth');
  const tValidation = useTranslations('validation');
  const locale = useLocale();
  const router = useRouter();
  const [state, actionDispatch] = useActionState(action, INITIAL_AUTH_ACTION_STATE);
  const [isPending, startTransition] = useTransition();
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const methods = useForm<TValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues as DefaultValues<TValues>,
    mode: 'onBlur'
  });
  const { focusFirstError, registerFieldRef } = useFormErrors('auth');

  useEffect(() => {
    if (!state.fieldErrors) {
      return;
    }

    Object.entries(state.fieldErrors).forEach(([field, key]) => {
      methods.setError(field as FieldPath<TValues>, {
        type: 'server',
        message: key
      });
    });
    focusFirstError(
      Object.fromEntries(
        Object.entries(state.fieldErrors).map(([field, key]) => [
          field,
          translateKey(key, tAuth, tValidation)
        ])
      )
    );
  }, [focusFirstError, methods, state.fieldErrors, tAuth, tValidation]);

  useEffect(() => {
    if (state.status !== 'success') {
      return;
    }

    setSubmitSuccess(true);
    successTimerRef.current = setTimeout(() => {
      if (state.redirectTo) {
        router.push(state.redirectTo);
      }
      setSubmitSuccess(false);
    }, 800);

    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, [router, state.redirectTo, state.status]);

  const handleClientSubmit = methods.handleSubmit(
    (_values, event) => {
      const formElement = event?.currentTarget;
      if (!formElement) {
        return;
      }
      const formData = new FormData(formElement);
      formData.set('locale', locale);
      startTransition(async () => {
        await actionDispatch(formData);
      });
    },
    formErrors => {
      focusFirstError(buildFieldErrorMap(formErrors, tAuth, tValidation));
    }
  );

  return {
    locale,
    methods,
    state,
    submitSuccess,
    isPending,
    registerFieldRef,
    handleClientSubmit,
    tAuth,
    tValidation,
    translateMessage: (key?: string, values?: Record<string, string | number>) => {
      if (!key) {
        return '';
      }

      if (key.startsWith('auth.') && values) {
        return tAuth(key.replace('auth.', ''), values);
      }

      return translateKey(key, tAuth, tValidation);
    }
  };
}

function PasswordStrengthMeter({ password, tAuth }: { password: string; tAuth: TranslationFn }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/~`]/.test(password)
  ].filter(Boolean).length;

  const tone = score >= 4 ? 'bg-[var(--state-paid,#166534)]' : 'bg-[var(--cta)]';
  const hint =
    score >= 4
      ? 'auth.password_strength.strong'
      : score >= 2
        ? 'auth.password_strength.medium'
        : 'auth.password_strength.soft';

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={cn('h-1 flex-1 rounded-full bg-[var(--bb-text-tint-10)]', index < score && tone)}
          />
        ))}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{translateKey(hint, tAuth, tAuth)}</p>
    </div>
  );
}

function AuthInput({
  id,
  label,
  placeholder,
  type = 'text',
  error,
  success,
  disabled,
  helper,
  inputProps,
  registerFieldRef,
  successText,
  toggleLabels
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password';
  error?: string;
  success?: boolean;
  disabled?: boolean;
  helper?: string;
  inputProps: Record<string, unknown>;
  registerFieldRef: (fieldName: string) => (el: HTMLElement | null) => void;
  successText: string;
  toggleLabels?: { show: string; hide: string };
}) {
  const [showPassword, setShowPassword] = useState(false);
  const invalid = Boolean(error);
  const helperId = invalid ? `${id}-error` : success ? `${id}-success` : undefined;

  return (
    <label className="block space-y-2">
      <span className="label-md text-[var(--text-primary)]">{label}</span>
      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          type={type === 'password' && showPassword ? 'text' : type}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={helperId}
          className={cn(
            'min-h-12 w-full rounded-[16px] border bg-[var(--bb-white-75)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-colors',
            invalid
              ? 'border-[var(--state-failed,#b42318)]'
              : success
                ? 'border-[var(--state-paid,#166534)]'
                : 'border-[var(--bb-border-soft)] focus:border-[var(--color-focus-ring)]',
            disabled && 'cursor-not-allowed bg-[var(--bb-text-tint-10)] text-[var(--text-secondary)]',
            type === 'password' && 'pr-12'
          )}
          ref={element => {
            registerFieldRef(id)(element);
            if (typeof inputProps.ref === 'function') {
              inputProps.ref(element);
            }
          }}
          {...inputProps}
        />
        {type === 'password' && toggleLabels ? (
          <button
            type="button"
            onClick={() => setShowPassword(current => !current)}
            aria-pressed={showPassword}
            aria-label={showPassword ? toggleLabels.hide : toggleLabels.show}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--text-muted)]"
          >
            {showPassword ? <EyeSlashMini /> : <EyeMini />}
          </button>
        ) : null}
      </div>
      {invalid ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm text-[var(--state-failed,#b42318)]"
        >
          {error}
        </p>
      ) : success ? (
        <p
          id={`${id}-success`}
          className="text-sm text-[var(--state-paid,#166534)]"
        >
          {successText}
        </p>
      ) : helper ? (
        <p className="text-sm text-[var(--text-secondary)]">{helper}</p>
      ) : null}
    </label>
  );
}

function SubmitButton({
  children,
  pending,
  success,
  unavailable
}: {
  children: React.ReactNode;
  pending: boolean;
  success: boolean;
  unavailable?: boolean;
}) {
  return (
    <Button
      type="submit"
      unavailable={unavailable}
      disabled={pending}
      loading={pending}
      className="mt-2 flex w-full justify-center rounded-full !px-6 !py-3 uppercase"
    >
      {success ? '✓' : children}
    </Button>
  );
}

export function LoginAuthForm() {
  const form = useActionForm<LoginValues>({
    schema: loginSchema,
    initialValues: {
      email: '',
      password: '',
      rememberMe: false
    },
    action: loginWithEmailPassword
  });
  const {
    methods,
    state,
    submitSuccess,
    isPending,
    registerFieldRef,
    handleClientSubmit,
    locale,
    tAuth,
    tValidation
  } = form;
  const emailValue = methods.watch('email');
  const passwordValue = methods.watch('password');
  const emailState = methods.getFieldState('email');
  const passwordState = methods.getFieldState('password');
  const authError = translateKey(state.formError, tAuth, tValidation);

  return (
    <form
      onSubmit={handleClientSubmit}
      className="space-y-5"
      data-testid="auth-login-form"
    >
      {authError ? (
        <div className="rounded-[16px] border border-[var(--state-failed,#b42318)] px-4 py-3 text-sm text-[var(--state-failed,#b42318)]">
          {authError}
        </div>
      ) : null}
      <AuthInput
        id="email"
        label={tAuth('email_label')}
        placeholder={tAuth('email_placeholder')}
        type="email"
        error={
          emailState.error ? translateKey(emailState.error.message, tAuth, tValidation) : undefined
        }
        success={emailState.isTouched && !emailState.error && Boolean(emailValue)}
        successText={tAuth('field_success')}
        inputProps={methods.register('email')}
        registerFieldRef={registerFieldRef}
      />
      <AuthInput
        id="password"
        label={tAuth('password_label')}
        placeholder={tAuth('password_placeholder')}
        type="password"
        error={
          passwordState.error
            ? translateKey(passwordState.error.message, tAuth, tValidation)
            : undefined
        }
        success={passwordState.isTouched && !passwordState.error && Boolean(passwordValue)}
        successText={tAuth('field_success')}
        inputProps={methods.register('password')}
        registerFieldRef={registerFieldRef}
        toggleLabels={{
          show: tAuth('show_password'),
          hide: tAuth('hide_password')
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox
          checked={methods.watch('rememberMe')}
          label={<span className="text-sm text-[var(--text-primary)]">{tAuth('remember_me')}</span>}
          {...methods.register('rememberMe')}
        />
        <LocalizedClientLink
          href="/forgot-password"
          locale={locale}
          className="text-sm text-[var(--cta-hover)] underline underline-offset-4"
        >
          {tAuth('forgot_password_link')}
        </LocalizedClientLink>
      </div>
      <SubmitButton
        pending={isPending}
        success={submitSuccess}
      >
        {tAuth('login_button')}
      </SubmitButton>
      <div className="space-y-3 pt-1">
        <LocalizedClientLink
          href="/user/recover"
          locale={locale}
          className="block rounded-full border border-dashed border-[var(--bb-border-soft)] px-4 py-3 text-center text-sm text-[var(--text-secondary)]"
        >
          {tAuth('magic_link_option')}
        </LocalizedClientLink>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            unavailable
            className="rounded-full !px-4 !py-3"
          >
            {tAuth('social_google')}
          </Button>
          <Button
            unavailable
            className="rounded-full !px-4 !py-3"
          >
            {tAuth('social_apple')}
          </Button>
        </div>
      </div>
      <p className="text-center text-sm text-[var(--text-secondary)]">
        {tAuth('no_account')}{' '}
        <LocalizedClientLink
          href="/register"
          locale={locale}
          className="text-[var(--cta-hover)] underline underline-offset-4"
        >
          {tAuth('register_link')}
        </LocalizedClientLink>
      </p>
    </form>
  );
}

export function RegisterAuthForm() {
  const form = useActionForm<RegisterValues>({
    schema: registerSchema,
    initialValues: {
      firstName: '',
      email: '',
      password: '',
      confirmPassword: '',
      termsConsent: false,
      privacyConsent: false,
      rodoConsent: false,
      marketingConsent: false
    },
    action: registerCustomer
  });
  const {
    methods,
    state,
    submitSuccess,
    isPending,
    registerFieldRef,
    handleClientSubmit,
    locale,
    tAuth,
    tValidation
  } = form;
  const authError = translateKey(state.formError, tAuth, tValidation);
  const password = methods.watch('password');

  return (
    <form
      onSubmit={handleClientSubmit}
      className="space-y-5"
      data-testid="auth-register-form"
    >
      {authError ? (
        <div className="rounded-[16px] border border-[var(--state-failed,#b42318)] px-4 py-3 text-sm text-[var(--state-failed,#b42318)]">
          {authError}
        </div>
      ) : null}
      <AuthInput
        id="firstName"
        label={tAuth('first_name_label')}
        placeholder={tAuth('first_name_placeholder')}
        error={
          methods.getFieldState('firstName').error
            ? translateKey(methods.getFieldState('firstName').error?.message, tAuth, tValidation)
            : undefined
        }
        success={
          methods.getFieldState('firstName').isTouched &&
          !methods.getFieldState('firstName').error &&
          Boolean(methods.watch('firstName'))
        }
        successText={tAuth('field_success')}
        inputProps={methods.register('firstName')}
        registerFieldRef={registerFieldRef}
      />
      <AuthInput
        id="email"
        label={tAuth('email_label')}
        placeholder={tAuth('email_placeholder')}
        type="email"
        error={
          methods.getFieldState('email').error
            ? translateKey(methods.getFieldState('email').error?.message, tAuth, tValidation)
            : undefined
        }
        success={
          methods.getFieldState('email').isTouched &&
          !methods.getFieldState('email').error &&
          Boolean(methods.watch('email'))
        }
        successText={tAuth('field_success')}
        inputProps={methods.register('email')}
        registerFieldRef={registerFieldRef}
      />
      <div className="space-y-2">
        <AuthInput
          id="password"
          label={tAuth('password_label')}
          placeholder={tAuth('password_helper')}
          type="password"
          error={
            methods.getFieldState('password').error
              ? translateKey(methods.getFieldState('password').error?.message, tAuth, tValidation)
              : undefined
          }
          success={
            methods.getFieldState('password').isTouched &&
            !methods.getFieldState('password').error &&
            Boolean(password)
          }
          successText={tAuth('field_success')}
          inputProps={methods.register('password')}
          registerFieldRef={registerFieldRef}
          toggleLabels={{
            show: tAuth('show_password'),
            hide: tAuth('hide_password')
          }}
        />
        <PasswordStrengthMeter
          password={password}
          tAuth={tAuth}
        />
      </div>
      <AuthInput
        id="confirmPassword"
        label={tAuth('confirm_password_label')}
        type="password"
        error={
          methods.getFieldState('confirmPassword').error
            ? translateKey(
                methods.getFieldState('confirmPassword').error?.message,
                tAuth,
                tValidation
              )
            : undefined
        }
        success={
          methods.getFieldState('confirmPassword').isTouched &&
          !methods.getFieldState('confirmPassword').error &&
          Boolean(methods.watch('confirmPassword'))
        }
        successText={tAuth('field_success')}
        inputProps={methods.register('confirmPassword')}
        registerFieldRef={registerFieldRef}
        toggleLabels={{
          show: tAuth('show_password'),
          hide: tAuth('hide_password')
        }}
      />
      <div className="space-y-3">
        <Checkbox
          checked={methods.watch('termsConsent')}
          error={Boolean(methods.getFieldState('termsConsent').error)}
          {...methods.register('termsConsent')}
          label={
            <span className="text-sm text-[var(--text-primary)]">
              {tAuth('terms_consent_prefix')}{' '}
              <LocalizedClientLink
                href="/regulamin"
                locale={locale}
                className="underline underline-offset-4"
              >
                {tAuth('terms_link_label')}
              </LocalizedClientLink>
            </span>
          }
        />
        <Checkbox
          checked={methods.watch('privacyConsent')}
          error={Boolean(methods.getFieldState('privacyConsent').error)}
          {...methods.register('privacyConsent')}
          label={
            <span className="text-sm text-[var(--text-primary)]">
              {tAuth('privacy_consent_prefix')}{' '}
              <LocalizedClientLink
                href="/polityka-prywatnosci"
                locale={locale}
                className="underline underline-offset-4"
              >
                {tAuth('privacy_link_label')}
              </LocalizedClientLink>
            </span>
          }
        />
        <Checkbox
          checked={methods.watch('rodoConsent')}
          error={Boolean(methods.getFieldState('rodoConsent').error)}
          {...methods.register('rodoConsent')}
          label={
            <span className="text-sm text-[var(--text-primary)]">
              {tAuth('rodo_consent_label')}
            </span>
          }
        />
        <Checkbox
          checked={methods.watch('marketingConsent')}
          {...methods.register('marketingConsent')}
          label={
            <span className="text-sm text-[var(--text-primary)]">
              {tAuth('marketing_consent_label')}
            </span>
          }
        />
      </div>
      <SubmitButton
        pending={isPending}
        success={submitSuccess}
      >
        {tAuth('create_account')}
      </SubmitButton>
      <p className="text-center text-sm text-[var(--text-secondary)]">
        {tAuth('already_have_account')}{' '}
        <LocalizedClientLink
          href="/login"
          locale={locale}
          className="text-[var(--cta-hover)] underline underline-offset-4"
        >
          {tAuth('login_link')}
        </LocalizedClientLink>
      </p>
    </form>
  );
}

export function ForgotPasswordAuthForm() {
  const form = useActionForm<ForgotPasswordValues>({
    schema: forgotPasswordSchema,
    initialValues: {
      email: ''
    },
    action: sendForgotPasswordRequest
  });
  const {
    methods,
    state,
    submitSuccess,
    isPending,
    registerFieldRef,
    handleClientSubmit,
    locale,
    tAuth,
    tValidation
  } = form;
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state.cooldownUntil) {
      setCooldownUntil(state.cooldownUntil);
    }
  }, [state.cooldownUntil]);

  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= now) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil, now]);

  const remaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  if (state.status === 'success') {
    return (
      <div
        className="space-y-4 text-center"
        data-testid="forgot-password-success"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bb-trust-card-bg)] text-[var(--state-paid,#166534)]">
          ✓
        </div>
        <h2 className="heading-sm text-[var(--text-primary)]">{tAuth('forgot.success_title')}</h2>
        <p className="text-md text-[var(--text-secondary)]">
          {tAuth('forgot.success_body', {
            email: state.submittedEmail ?? tAuth('email_placeholder')
          })}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">{tAuth('forgot.success_neutral')}</p>
        <button
          type="button"
          disabled={remaining > 0}
          className="text-sm text-[var(--text-secondary)] underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline"
          onClick={() => {
            const formElement = document.getElementById(
              'forgot-password-form'
            ) as HTMLFormElement | null;
            formElement?.requestSubmit();
          }}
        >
          {remaining > 0
            ? tAuth('forgot.resend_cooldown', { seconds: remaining })
            : tAuth('forgot.resend_ready')}
        </button>
        <LocalizedClientLink
          href="/login"
          locale={locale}
          className="block text-sm text-[var(--cta-hover)] underline underline-offset-4"
        >
          {tAuth('back_to_login')}
        </LocalizedClientLink>
        <form
          id="forgot-password-form"
          onSubmit={handleClientSubmit}
          className="hidden"
        >
          <input
            type="hidden"
            value={state.submittedEmail ?? methods.getValues('email')}
            {...methods.register('email')}
          />
        </form>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleClientSubmit}
      className="space-y-5"
      data-testid="auth-forgot-password-form"
    >
      <AuthInput
        id="email"
        label={tAuth('email_label')}
        placeholder={tAuth('email_placeholder')}
        type="email"
        error={
          methods.getFieldState('email').error
            ? translateKey(methods.getFieldState('email').error?.message, tAuth, tValidation)
            : undefined
        }
        success={
          methods.getFieldState('email').isTouched &&
          !methods.getFieldState('email').error &&
          Boolean(methods.watch('email'))
        }
        successText={tAuth('field_success')}
        inputProps={methods.register('email')}
        registerFieldRef={registerFieldRef}
      />
      <SubmitButton
        pending={isPending}
        success={submitSuccess}
      >
        {tAuth('forgot.submit')}
      </SubmitButton>
      <LocalizedClientLink
        href="/login"
        locale={locale}
        className="block text-center text-sm text-[var(--cta-hover)] underline underline-offset-4"
      >
        {tAuth('back_to_login')}
      </LocalizedClientLink>
    </form>
  );
}

export function ResetPasswordAuthForm({ token }: { token?: string }) {
  const form = useActionForm<ResetPasswordValues>({
    schema: resetPasswordSchema,
    initialValues: {
      token: token ?? '',
      password: '',
      confirmPassword: ''
    },
    action: resetPasswordWithToken
  });
  const {
    methods,
    state,
    submitSuccess,
    isPending,
    registerFieldRef,
    handleClientSubmit,
    tAuth,
    tValidation
  } = form;
  const authError = translateKey(state.formError, tAuth, tValidation);
  const password = methods.watch('password');

  if (!token) {
    return (
      <div
        className="space-y-4 text-center"
        data-testid="reset-password-invalid-token"
      >
        <div className="rounded-[16px] border border-[var(--state-failed,#b42318)] px-4 py-4 text-sm text-[var(--state-failed,#b42318)]">
          {tAuth('reset.invalid_token')}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleClientSubmit}
      className="space-y-5"
      data-testid="auth-reset-password-form"
    >
      {authError ? (
        <div className="rounded-[16px] border border-[var(--state-failed,#b42318)] px-4 py-3 text-sm text-[var(--state-failed,#b42318)]">
          {authError}
        </div>
      ) : null}
      <input
        type="hidden"
        value={token}
        {...methods.register('token')}
      />
      <div className="space-y-2">
        <AuthInput
          id="password"
          label={tAuth('new_password_label')}
          placeholder={tAuth('password_helper')}
          type="password"
          error={
            methods.getFieldState('password').error
              ? translateKey(methods.getFieldState('password').error?.message, tAuth, tValidation)
              : undefined
          }
          success={
            methods.getFieldState('password').isTouched &&
            !methods.getFieldState('password').error &&
            Boolean(password)
          }
          successText={tAuth('field_success')}
          inputProps={methods.register('password')}
          registerFieldRef={registerFieldRef}
          toggleLabels={{ show: tAuth('show_password'), hide: tAuth('hide_password') }}
        />
        <PasswordStrengthMeter
          password={password}
          tAuth={tAuth}
        />
      </div>
      <AuthInput
        id="confirmPassword"
        label={tAuth('confirm_password_label')}
        type="password"
        error={
          methods.getFieldState('confirmPassword').error
            ? translateKey(
                methods.getFieldState('confirmPassword').error?.message,
                tAuth,
                tValidation
              )
            : undefined
        }
        success={
          methods.getFieldState('confirmPassword').isTouched &&
          !methods.getFieldState('confirmPassword').error &&
          Boolean(methods.watch('confirmPassword'))
        }
        successText={tAuth('field_success')}
        inputProps={methods.register('confirmPassword')}
        registerFieldRef={registerFieldRef}
        toggleLabels={{ show: tAuth('show_password'), hide: tAuth('hide_password') }}
      />
      <SubmitButton
        pending={isPending}
        success={submitSuccess}
      >
        {tAuth('reset.submit')}
      </SubmitButton>
    </form>
  );
}

export function InlineRegisterAuthForm({
  email,
  orderReference
}: {
  email?: string;
  orderReference?: string;
}) {
  const form = useActionForm<InlineRegisterValues>({
    schema: inlineRegisterSchema,
    initialValues: {
      email: email ?? '',
      password: '',
      confirmPassword: '',
      termsConsent: false
    },
    action: registerInlineCustomer
  });
  const {
    methods,
    state,
    submitSuccess,
    isPending,
    registerFieldRef,
    handleClientSubmit,
    locale,
    tAuth,
    tValidation
  } = form;
  const password = methods.watch('password');
  const authError = translateKey(state.formError, tAuth, tValidation);

  return (
    <div className="bb-card grid gap-6 rounded-[28px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-96)] p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <p className="bb-eyebrow">{tAuth('inline.eyebrow')}</p>
        <h1 className="heading-md text-[var(--text-primary)]">{tAuth('inline.title')}</h1>
        <p className="text-md text-[var(--text-secondary)]">{tAuth('inline.subtitle')}</p>
        {orderReference ? (
          <div className="rounded-[16px] border border-[var(--bb-trust-tint-18)] bg-[var(--bb-trust-card-bg)] px-4 py-3 text-sm text-[var(--text-primary)]">
            {tAuth('inline.order_notice', { orderReference, email: email ?? '' })}
          </div>
        ) : null}
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
          <li>{tAuth('inline.benefit_orders')}</li>
          <li>{tAuth('inline.benefit_wishlist')}</li>
          <li>{tAuth('inline.benefit_checkout')}</li>
        </ul>
      </div>

      <form
        onSubmit={handleClientSubmit}
        className="space-y-4"
        data-testid="auth-inline-register-form"
      >
        {authError ? (
          <div className="rounded-[16px] border border-[var(--state-failed,#b42318)] px-4 py-3 text-sm text-[var(--state-failed,#b42318)]">
            {authError}
          </div>
        ) : null}
        <AuthInput
          id="email"
          label={tAuth('email_label')}
          type="email"
          disabled={Boolean(email)}
          error={
            methods.getFieldState('email').error
              ? translateKey(methods.getFieldState('email').error?.message, tAuth, tValidation)
              : undefined
          }
          success={
            methods.getFieldState('email').isTouched &&
            !methods.getFieldState('email').error &&
            Boolean(methods.watch('email'))
          }
          successText={tAuth('field_success')}
          inputProps={methods.register('email')}
          registerFieldRef={registerFieldRef}
        />
        <div className="space-y-2">
          <AuthInput
            id="password"
            label={tAuth('inline.password_label')}
            placeholder={tAuth('password_helper')}
            type="password"
            error={
              methods.getFieldState('password').error
                ? translateKey(methods.getFieldState('password').error?.message, tAuth, tValidation)
                : undefined
            }
            success={
              methods.getFieldState('password').isTouched &&
              !methods.getFieldState('password').error &&
              Boolean(password)
            }
            successText={tAuth('field_success')}
            inputProps={methods.register('password')}
            registerFieldRef={registerFieldRef}
            toggleLabels={{ show: tAuth('show_password'), hide: tAuth('hide_password') }}
          />
          <PasswordStrengthMeter
            password={password}
            tAuth={tAuth}
          />
        </div>
        <AuthInput
          id="confirmPassword"
          label={tAuth('confirm_password_label')}
          type="password"
          error={
            methods.getFieldState('confirmPassword').error
              ? translateKey(
                  methods.getFieldState('confirmPassword').error?.message,
                  tAuth,
                  tValidation
                )
              : undefined
          }
          success={
            methods.getFieldState('confirmPassword').isTouched &&
            !methods.getFieldState('confirmPassword').error &&
            Boolean(methods.watch('confirmPassword'))
          }
          successText={tAuth('field_success')}
          inputProps={methods.register('confirmPassword')}
          registerFieldRef={registerFieldRef}
          toggleLabels={{ show: tAuth('show_password'), hide: tAuth('hide_password') }}
        />
        <Checkbox
          checked={methods.watch('termsConsent')}
          error={Boolean(methods.getFieldState('termsConsent').error)}
          {...methods.register('termsConsent')}
          label={
            <span className="text-sm text-[var(--text-primary)]">
              {tAuth('terms_consent_prefix')}{' '}
              <LocalizedClientLink
                href="/regulamin"
                locale={locale}
                className="underline underline-offset-4"
              >
                {tAuth('terms_link_label')}
              </LocalizedClientLink>
            </span>
          }
        />
        <SubmitButton
          pending={isPending}
          success={submitSuccess}
        >
          {tAuth('inline.submit')}
        </SubmitButton>
        <LocalizedClientLink
          href="/user"
          locale={locale}
          className="block text-center text-sm text-[var(--text-secondary)] underline underline-offset-4"
        >
          {tAuth('inline.skip')}
        </LocalizedClientLink>
      </form>
    </div>
  );
}
