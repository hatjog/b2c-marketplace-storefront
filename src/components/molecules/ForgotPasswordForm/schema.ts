import { z } from 'zod';

export const createForgotPasswordSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().nonempty(t('email_required')).email(t('email_invalid'))
  });

export type ForgotPasswordFormData = z.infer<ReturnType<typeof createForgotPasswordSchema>>;
