import { z } from 'zod';

export const createLoginFormSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().nonempty(t('email_required')).email(t('email_invalid')),
    password: z.string().nonempty(t('password_required'))
  });

export type LoginFormData = z.infer<ReturnType<typeof createLoginFormSchema>>;
