import { z } from 'zod';

export const createAddressSchema = (t: (key: string) => string) =>
  z.object({
    addressId: z.string().optional(),
    addressName: z.string().nonempty(t('address_name_required')),
    firstName: z.string().nonempty(t('first_name_required')),
    lastName: z.string().nonempty(t('last_name_required')),
    address: z.string().nonempty(t('address_required')),
    city: z.string().nonempty(t('city_required')),
    countryCode: z.string().nonempty(t('country_required')),
    postalCode: z.string().nonempty(t('postal_code_required')),
    company: z.string().optional(),
    province: z.string().optional(),
    phone: z
      .string()
      .nonempty(t('phone_required'))
      .regex(/^\+?[0-9\s\-()]+$/, t('phone_invalid_format')),
    metadata: z.record(z.any()).optional()
  });

export type AddressFormData = z.infer<ReturnType<typeof createAddressSchema>>;
