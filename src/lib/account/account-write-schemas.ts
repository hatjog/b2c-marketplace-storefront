import { z } from 'zod';

const MAX_RETURN_PHOTOS = 3;
const MAX_RETURN_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_RETURN_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const RETURN_REQUEST_REASON_REQUIRED = 'return_request.errors.reason_required';
export const RETURN_REQUEST_COMMENT_TOO_LONG = 'return_request.errors.comment_too_long';
export const RETURN_REQUEST_NO_FILES = 'return_request.errors.photo_required';
export const RETURN_REQUEST_TOO_MANY_FILES = 'return_request.errors.photo_limit';
export const RETURN_REQUEST_FILE_TOO_LARGE = 'return_request.errors.photo_size';
export const RETURN_REQUEST_FILE_INVALID_TYPE = 'return_request.errors.photo_type';

export const ADDRESS_REQUIRED = {
  addressName: 'addresses.form.errors.address_name_required',
  firstName: 'addresses.form.errors.first_name_required',
  lastName: 'addresses.form.errors.last_name_required',
  address1: 'addresses.form.errors.address_required',
  city: 'addresses.form.errors.city_required',
  countryCode: 'addresses.form.errors.country_required',
  postalCode: 'addresses.form.errors.postal_code_required',
  phone: 'addresses.form.errors.phone_required',
} as const;

export const REVIEW_ERRORS = {
  ratingRequired: 'written_reviews.form.errors.rating_required',
  noteTooLong: 'written_reviews.form.errors.note_too_long',
  reviewIdRequired: 'written_reviews.form.errors.review_id_required',
  orderIdRequired: 'written_reviews.form.errors.order_id_required',
  sellerIdRequired: 'written_reviews.form.errors.seller_id_required',
} as const;

export const SETTINGS_ERRORS = {
  firstNameRequired: 'settings.profile.errors.first_name_required',
  lastNameRequired: 'settings.profile.errors.last_name_required',
  phoneRequired: 'settings.profile.errors.phone_required',
  emailRequired: 'settings.profile.errors.email_required',
  emailInvalid: 'settings.profile.errors.email_invalid',
  localeRequired: 'settings.profile.errors.locale_required',
  passwordTooShort: 'settings.security.errors.password_too_short',
  passwordMismatch: 'settings.security.errors.password_mismatch',
  invalidCardToken: 'settings.payments.errors.invalid_card_token',
} as const;

// Last-4 card token format only — full PAN/CVV never accepted via this surface.
export const PAYMENT_CARD_TOKEN_PATTERN = /^(ending-)?\d{2,4}$/;

// Medusa/Mercur order ID format guard — alphanumeric + `_`/`-` only.
// Eliminates path traversal in revalidatePath/redirectPath construction.
export const ORDER_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const returnRequestSchema = z.object({
  orderId: z
    .string()
    .min(1, 'return_request.errors.order_required')
    .regex(ORDER_ID_PATTERN, 'return_request.errors.order_required'),
  reasonId: z.string().min(1, RETURN_REQUEST_REASON_REQUIRED),
  comment: z.string().trim().max(500, RETURN_REQUEST_COMMENT_TOO_LONG).optional().default(''),
});

export const addressSchema = z.object({
  addressId: z.string().optional(),
  addressName: z.string().trim().min(1, ADDRESS_REQUIRED.addressName),
  firstName: z.string().trim().min(1, ADDRESS_REQUIRED.firstName),
  lastName: z.string().trim().min(1, ADDRESS_REQUIRED.lastName),
  company: z.string().trim().optional().default(''),
  address1: z.string().trim().min(1, ADDRESS_REQUIRED.address1),
  city: z.string().trim().min(1, ADDRESS_REQUIRED.city),
  countryCode: z.string().trim().min(1, ADDRESS_REQUIRED.countryCode),
  postalCode: z.string().trim().min(1, ADDRESS_REQUIRED.postalCode),
  province: z.string().trim().optional().default(''),
  phone: z.string().trim().min(1, ADDRESS_REQUIRED.phone),
});

export const reviewMutationSchema = z.object({
  reviewId: z.string().min(1, REVIEW_ERRORS.reviewIdRequired),
  orderId: z.string().min(1, REVIEW_ERRORS.orderIdRequired),
  rating: z.coerce.number().min(1, REVIEW_ERRORS.ratingRequired).max(5),
  note: z.string().trim().max(300, REVIEW_ERRORS.noteTooLong).optional().default(''),
});

export const reviewCreateSchema = z.object({
  orderId: z.string().min(1, REVIEW_ERRORS.orderIdRequired),
  sellerId: z.string().min(1, REVIEW_ERRORS.sellerIdRequired),
  rating: z.coerce.number().min(1, REVIEW_ERRORS.ratingRequired).max(5),
  note: z.string().trim().max(300, REVIEW_ERRORS.noteTooLong).optional().default(''),
});

export const reviewDeleteSchema = z.object({
  reviewId: z.string().min(1, REVIEW_ERRORS.reviewIdRequired),
});

export const profileSettingsSchema = z.object({
  firstName: z.string().trim().min(1, SETTINGS_ERRORS.firstNameRequired),
  lastName: z.string().trim().min(1, SETTINGS_ERRORS.lastNameRequired),
  phone: z.string().trim().min(1, SETTINGS_ERRORS.phoneRequired),
  email: z.string().trim().min(1, SETTINGS_ERRORS.emailRequired).email(SETTINGS_ERRORS.emailInvalid),
  locale: z.string().trim().min(1, SETTINGS_ERRORS.localeRequired),
});

export const securitySettingsSchema = z
  .object({
    email: z.string().trim().min(1, SETTINGS_ERRORS.emailRequired).email(SETTINGS_ERRORS.emailInvalid),
    password: z.string().trim().min(8, SETTINGS_ERRORS.passwordTooShort),
    confirmPassword: z.string().trim().min(8, SETTINGS_ERRORS.passwordTooShort),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: SETTINGS_ERRORS.passwordMismatch,
    path: ['confirmPassword'],
  });

// Notification preferences are stored as opt-in flags only.
// Schema rejects unexpected payload shapes while allowing absent keys (unchecked checkbox).
export const notificationSettingsSchema = z.object({
  emailUpdates: z
    .union([z.literal('on'), z.literal('off')])
    .optional(),
  smsUpdates: z
    .union([z.literal('on'), z.literal('off')])
    .optional(),
  productNews: z
    .union([z.literal('on'), z.literal('off')])
    .optional(),
});

// Payment surface accepts ONLY a last-4 card token (e.g. `ending-4242`).
// Full PAN / CVV are rejected at the schema gate before any persistence call.
export const paymentSettingsSchema = z.object({
  defaultCard: z
    .string()
    .trim()
    .min(1, SETTINGS_ERRORS.invalidCardToken)
    .regex(PAYMENT_CARD_TOKEN_PATTERN, SETTINGS_ERRORS.invalidCardToken),
  invoicesByEmail: z
    .union([z.literal('on'), z.literal('off')])
    .optional(),
});

// GDPR request type — strict allowlist; any other value is rejected and not persisted.
export const privacyRequestSchema = z.object({
  requestType: z.union([z.literal('export'), z.literal('delete')], {
    errorMap: () => ({ message: 'settings.privacy.errors.generic' }),
  }),
});

export type ReturnRequestFormValues = z.infer<typeof returnRequestSchema>;
export type AddressFormValues = z.infer<typeof addressSchema>;
export type ReviewMutationFormValues = z.infer<typeof reviewMutationSchema>;
export type ReviewCreateFormValues = z.infer<typeof reviewCreateSchema>;
export type ReviewDeleteFormValues = z.infer<typeof reviewDeleteSchema>;
export type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>;
export type SecuritySettingsFormValues = z.infer<typeof securitySettingsSchema>;
export type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;
export type PaymentSettingsFormValues = z.infer<typeof paymentSettingsSchema>;
export type PrivacyRequestFormValues = z.infer<typeof privacyRequestSchema>;

export function validateReturnFiles(files: File[]) {
  if (files.length === 0) {
    return RETURN_REQUEST_NO_FILES;
  }

  if (files.length > MAX_RETURN_PHOTOS) {
    return RETURN_REQUEST_TOO_MANY_FILES;
  }

  for (const file of files) {
    if (file.size > MAX_RETURN_FILE_SIZE) {
      return RETURN_REQUEST_FILE_TOO_LARGE;
    }

    if (!ACCEPTED_RETURN_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_RETURN_IMAGE_TYPES)[number])) {
      return RETURN_REQUEST_FILE_INVALID_TYPE;
    }
  }

  return null;
}
