import { z } from 'zod';

export const createProfileDetailsSchema = (t: (key: string) => string) =>
  z.object({
    firstName: z.string().nonempty(t('first_name_required')),
    lastName: z.string().nonempty(t('last_name_required')),
    phone: z.string().nonempty(t('phone_required')),
    email: z.string().nonempty(t('email_required'))
  });

export type ProfileDetailsFormData = z.infer<ReturnType<typeof createProfileDetailsSchema>>;
