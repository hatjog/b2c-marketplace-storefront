import { z } from 'zod';

const validationKey = (key: string) => `validation.${key}` as const;

const emailSchema = z
  .string()
  .trim()
  .min(1, validationKey('email_required'))
  .email(validationKey('email_invalid'))
  .max(100, validationKey('email_max'));

const passwordSchema = z
  .string()
  .min(8, validationKey('password_min_length'))
  .max(64, validationKey('password_max'))
  .regex(/[a-z]/, validationKey('password_lowercase'))
  .regex(/[A-Z]/, validationKey('password_uppercase'))
  .regex(/[0-9!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/~`]/, validationKey('password_symbol'));

const consentSchema = (key: string) => z.boolean().refine(value => value, validationKey(key));

export const loginSchema = z.object({
  locale: z.string().optional(),
  email: emailSchema,
  password: z.string().min(1, validationKey('password_required')),
  rememberMe: z.boolean().optional().default(false)
});

export const registerSchema = z
  .object({
    locale: z.string().optional(),
    firstName: z
      .string()
      .trim()
      .min(1, validationKey('first_name_required'))
      .max(50, validationKey('first_name_max')),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, validationKey('confirm_password_required')),
    termsConsent: consentSchema('terms_required'),
    privacyConsent: consentSchema('privacy_required'),
    rodoConsent: consentSchema('rodo_required'),
    marketingConsent: z.boolean().optional().default(false)
  })
  .refine(values => values.password === values.confirmPassword, {
    message: validationKey('password_mismatch'),
    path: ['confirmPassword']
  });

export const forgotPasswordSchema = z.object({
  locale: z.string().optional(),
  email: emailSchema
});

export const resetPasswordSchema = z
  .object({
    locale: z.string().optional(),
    token: z.string().trim().min(1, 'auth.reset.invalid_token'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, validationKey('confirm_password_required'))
  })
  .refine(values => values.password === values.confirmPassword, {
    message: validationKey('password_mismatch'),
    path: ['confirmPassword']
  });

export const inlineRegisterSchema = z
  .object({
    locale: z.string().optional(),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, validationKey('confirm_password_required')),
    termsConsent: consentSchema('terms_required')
  })
  .refine(values => values.password === values.confirmPassword, {
    message: validationKey('password_mismatch'),
    path: ['confirmPassword']
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type InlineRegisterValues = z.infer<typeof inlineRegisterSchema>;
