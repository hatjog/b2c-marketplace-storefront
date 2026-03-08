'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormProvider, useForm, useFormContext, type FieldError } from 'react-hook-form';

import { Button } from '@/components/atoms';
import { LabeledInput } from '@/components/cells';
import { sendResetPasswordEmail } from '@/lib/data/customer';
import { toast } from '@/lib/helpers/toast';

import { forgotPasswordSchema, type ForgotPasswordFormData } from './schema';

export const ForgotPasswordForm = () => {
  const methods = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <Form />
    </FormProvider>
  );
};

const Form = () => {
  const t = useTranslations('auth');
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    reset
  } = useFormContext<ForgotPasswordFormData>();

  const submit = async (data: ForgotPasswordFormData) => {
    if (!data.email) return;

    const result = await sendResetPasswordEmail(data.email);

    if (!result.success) {
      toast.error({ title: result.error || t('error_generic') });
      return;
    }

    reset({ email: '' });

    toast.success({
      title: t('password_reset_success', { email: data.email })
    });
  };

  return (
    <div
      className="mx-auto mt-6 w-full max-w-xl space-y-4 rounded-sm border p-4"
      data-testid="forgot-password-form-container"
    >
      <h1 className="heading-md my-0 mb-2 uppercase text-primary">{t('forgot_password_heading')}</h1>
      <p className="text-md">
        {t('forgot_password_description')}
      </p>
      <form
        onSubmit={handleSubmit(submit)}
        data-testid="forgot-password-form"
      >
        <div className="space-y-4">
          <LabeledInput
            label={t('email_label')}
            placeholder={t('email_placeholder')}
            error={errors.email as FieldError}
            data-testid="forgot-password-email-input"
            {...register('email')}
          />
        </div>

        <div className="mt-8 space-y-4">
          <Button
            className="w-full uppercase"
            disabled={isSubmitting}
            data-testid="forgot-password-submit-button"
          >
            {t('reset_password_button')}
          </Button>

          <Link
            href="/user"
            className="flex"
            data-testid="forgot-password-back-to-login-link"
          >
            <Button
              variant="tonal"
              className="flex w-full justify-center uppercase"
            >
              {t('back_to_login')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
};
