import { z } from 'zod';

export const createRegisterFormSchema = (t: (key: string) => string) =>
  z.object({
    firstName: z
      .string()
      .nonempty(t('first_name_required'))
      .max(50, t('first_name_max')),
    lastName: z
      .string()
      .nonempty(t('last_name_required'))
      .max(50, t('last_name_max')),
    email: z
      .string()
      .nonempty(t('email_required'))
      .email(t('email_invalid'))
      .max(60, t('email_max')),
    password: z
      .string()
      .nonempty(t('password_required'))
      .min(8, t('password_min_length'))
      .regex(/^(?=.*[A-Z])(?=.*[!@#$%^&*])/, {
        message: t('password_complexity')
      })
      .max(64, t('password_max')),
    phone: z
      .string()
      .min(6, t('phone_required'))
      .regex(/^\+?\d+$/, { message: t('phone_digits_only') })
      .max(20, t('phone_max'))
  });

export type RegisterFormData = z.infer<ReturnType<typeof createRegisterFormSchema>>;
