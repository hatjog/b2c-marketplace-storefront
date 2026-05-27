'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

import {
  addressSchema,
  notificationSettingsSchema,
  paymentSettingsSchema,
  privacyRequestSchema,
  profileSettingsSchema,
  returnRequestSchema,
  reviewCreateSchema,
  reviewDeleteSchema,
  reviewMutationSchema,
  securitySettingsSchema,
  validateReturnFiles
} from '@/lib/account/account-write-schemas';
import { getAuthHeaders } from '@/lib/data/cookies';
import {
  addCustomerAddress,
  deleteCustomerAddress,
  retrieveCustomer,
  sendResetPasswordEmail,
  updateCustomer,
  updateCustomerAddress
} from '@/lib/data/customer';
import { createReturnRequest } from '@/lib/data/orders';
import { resolveMedusaBackendUrl } from '@/lib/env';
import { localeAwareFetch, localePath } from '@/lib/sdk/locale-interceptor';

type ActionStatus = 'idle' | 'success' | 'error';

export interface AccountActionState {
  status: ActionStatus;
  messageKey?: string;
  fieldErrors?: Record<string, string>;
  redirectPath?: string;
}

const INITIAL_STATE: AccountActionState = {
  status: 'idle'
};

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();

async function revalidateLocalePath(path: string) {
  revalidatePath(await localePath(path));
}

function zodErrorsToFieldMap(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const field = String(issue.path[0] ?? 'form');
    if (!acc[field]) {
      acc[field] = issue.message;
    }
    return acc;
  }, {});
}

function withFieldErrors(error: z.ZodError): AccountActionState {
  return {
    status: 'error',
    messageKey: 'common.form_error',
    fieldErrors: zodErrorsToFieldMap(error)
  };
}

function buildAddressFormData(parsed: z.infer<typeof addressSchema>) {
  const formData = new FormData();

  if (parsed.addressId) {
    formData.set('addressId', parsed.addressId);
  }

  formData.set('address_name', parsed.addressName);
  formData.set('first_name', parsed.firstName);
  formData.set('last_name', parsed.lastName);
  formData.set('company', parsed.company);
  formData.set('address_1', parsed.address1);
  formData.set('city', parsed.city);
  formData.set('country_code', parsed.countryCode);
  formData.set('postal_code', parsed.postalCode);
  formData.set('province', parsed.province);
  formData.set('phone', parsed.phone);

  return formData;
}

async function mutateReview(
  method: 'POST' | 'PATCH' | 'DELETE',
  reviewId: string | null,
  payload?: Record<string, unknown>
) {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
    'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
  };

  const endpoint =
    method === 'POST'
      ? `${MEDUSA_BACKEND_URL}/store/reviews`
      : `${MEDUSA_BACKEND_URL}/store/reviews/${reviewId}`;

  const response = await localeAwareFetch(endpoint, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (!response.ok) {
    throw new Error('written_reviews.form.errors.generic');
  }
}

async function recordAccountRequest(
  requestType: string,
  payload: Record<string, unknown> = {}
): Promise<boolean> {
  const customer = await retrieveCustomer();

  if (!customer) return false;

  const metadata = ((customer as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<
    string,
    unknown
  >;
  const gpMetadata =
    metadata.gp && typeof metadata.gp === 'object' && !Array.isArray(metadata.gp)
      ? (metadata.gp as Record<string, unknown>)
      : {};
  const existingRequests = Array.isArray(gpMetadata.account_requests)
    ? gpMetadata.account_requests.slice(-19)
    : [];

  try {
    await updateCustomer({
      metadata: {
        ...metadata,
        gp: {
          ...gpMetadata,
          account_requests: [
            ...existingRequests,
            {
              id: `account_request_${Date.now()}`,
              type: requestType,
              status: 'received',
              submitted_at: new Date().toISOString(),
              payload
            }
          ]
        }
      }
    } as unknown as Parameters<typeof updateCustomer>[0]);
  } catch {
    return false;
  }

  return true;
}

export async function submitReturnRequest(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = returnRequestSchema.safeParse({
    orderId: formData.get('orderId'),
    reasonId: formData.get('reasonId'),
    comment: formData.get('comment')
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  const files = formData
    .getAll('photos')
    .filter((value): value is File => value instanceof File && value.size > 0);
  const fileError = validateReturnFiles(files);

  if (fileError) {
    return {
      status: 'error',
      messageKey: 'common.form_error',
      fieldErrors: { photos: fileError }
    };
  }

  const payload = new FormData();
  payload.set('order_id', parsed.data.orderId);
  payload.set('order_return_reason_id', parsed.data.reasonId);
  payload.set('customer_note', parsed.data.comment);
  files.forEach(file => {
    payload.append('photos', file, file.name);
    payload.append('attachment_names', file.name);
  });

  const response = await createReturnRequest(payload);

  if (response?.error) {
    return {
      status: 'error',
      messageKey: 'return_request.errors.generic'
    };
  }

  await revalidateLocalePath('/user/orders');
  await revalidateLocalePath(`/user/orders/${parsed.data.orderId}/return`);
  await revalidateLocalePath(`/user/orders/${parsed.data.orderId}/request-success`);

  return {
    status: 'success',
    messageKey: 'return_request.success.submitted',
    redirectPath: `/user/orders/${parsed.data.orderId}/request-success`
  };
}

export async function submitAddress(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = addressSchema.safeParse({
    addressId: formData.get('addressId') || undefined,
    addressName: formData.get('addressName'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    company: formData.get('company'),
    address1: formData.get('address1'),
    city: formData.get('city'),
    countryCode: formData.get('countryCode'),
    postalCode: formData.get('postalCode'),
    province: formData.get('province'),
    phone: formData.get('phone')
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  const payload = buildAddressFormData(parsed.data);
  const result = parsed.data.addressId
    ? await updateCustomerAddress(payload)
    : await addCustomerAddress(payload);

  if (!result?.success) {
    return {
      status: 'error',
      messageKey: 'addresses.form.errors.generic'
    };
  }

  await revalidateLocalePath('/user/addresses');

  return {
    status: 'success',
    messageKey: parsed.data.addressId
      ? 'addresses.form.success.updated'
      : 'addresses.form.success.created'
  };
}

export async function deleteAddressAction(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const addressId = formData.get('addressId');

  if (typeof addressId !== 'string' || addressId.length === 0) {
    return {
      status: 'error',
      messageKey: 'addresses.form.errors.generic',
      fieldErrors: { addressId: 'addresses.form.errors.generic' }
    };
  }

  const result = await deleteCustomerAddress(addressId);

  if (!result.success) {
    return {
      status: 'error',
      messageKey: 'addresses.form.errors.generic'
    };
  }

  await revalidateLocalePath('/user/addresses');

  return {
    status: 'success',
    messageKey: 'addresses.form.success.deleted'
  };
}

export async function createWrittenReview(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = reviewCreateSchema.safeParse({
    orderId: formData.get('orderId'),
    sellerId: formData.get('sellerId'),
    rating: formData.get('rating'),
    note: formData.get('note')
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  try {
    await mutateReview('POST', null, {
      order_id: parsed.data.orderId,
      rating: parsed.data.rating,
      reference: 'seller',
      reference_id: parsed.data.sellerId,
      customer_note: parsed.data.note
    });
  } catch {
    return {
      status: 'error',
      messageKey: 'written_reviews.form.errors.generic'
    };
  }

  await revalidateLocalePath('/user/reviews');
  await revalidateLocalePath('/user/reviews/written');

  return {
    status: 'success',
    messageKey: 'written_reviews.form.success.created'
  };
}

export async function updateWrittenReview(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = reviewMutationSchema.safeParse({
    reviewId: formData.get('reviewId'),
    orderId: formData.get('orderId'),
    rating: formData.get('rating'),
    note: formData.get('note')
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  try {
    await mutateReview('PATCH', parsed.data.reviewId, {
      rating: parsed.data.rating,
      customer_note: parsed.data.note,
      order_id: parsed.data.orderId
    });
  } catch {
    return {
      status: 'error',
      messageKey: 'written_reviews.form.errors.generic'
    };
  }

  await revalidateLocalePath('/user/reviews');
  await revalidateLocalePath('/user/reviews/written');

  return {
    status: 'success',
    messageKey: 'written_reviews.form.success.updated'
  };
}

export async function deleteWrittenReview(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = reviewDeleteSchema.safeParse({
    reviewId: formData.get('reviewId')
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  try {
    await mutateReview('DELETE', parsed.data.reviewId);
  } catch {
    return {
      status: 'error',
      messageKey: 'written_reviews.form.errors.generic'
    };
  }

  await revalidateLocalePath('/user/reviews');
  await revalidateLocalePath('/user/reviews/written');

  return {
    status: 'success',
    messageKey: 'written_reviews.form.success.deleted'
  };
}

export async function updateProfileSettings(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = profileSettingsSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    locale: formData.get('locale')
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  try {
    await updateCustomer({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone
    });
  } catch {
    return {
      status: 'error',
      messageKey: 'settings.profile.errors.generic'
    };
  }

  await revalidateLocalePath('/user/settings');

  return {
    status: 'success',
    messageKey: 'settings.profile.success.updated'
  };
}

export async function updateSecuritySettings(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = securitySettingsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword')
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  const result = await sendResetPasswordEmail(parsed.data.email);

  if (!result?.success) {
    return {
      status: 'error',
      messageKey: 'settings.security.errors.generic'
    };
  }

  return {
    status: 'success',
    messageKey: 'settings.security.success.reset_email_sent'
  };
}

export async function updateNotificationSettings(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = notificationSettingsSchema.safeParse({
    emailUpdates: formData.get('emailUpdates') ?? undefined,
    smsUpdates: formData.get('smsUpdates') ?? undefined,
    productNews: formData.get('productNews') ?? undefined
  });

  if (!parsed.success) {
    return {
      status: 'error',
      messageKey: 'settings.notifications.errors.generic'
    };
  }

  const recorded = await recordAccountRequest('notification_preferences', {
    emailUpdates: parsed.data.emailUpdates === 'on',
    smsUpdates: parsed.data.smsUpdates === 'on',
    productNews: parsed.data.productNews === 'on'
  });

  if (!recorded) {
    return {
      status: 'error',
      messageKey: 'settings.notifications.errors.generic'
    };
  }

  await revalidateLocalePath('/user/settings');

  return {
    status: 'success',
    messageKey: 'settings.notifications.success.request_received'
  };
}

export async function updatePaymentSettings(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  // PCI/PII guard: paymentSettingsSchema enforces last-4 card token only.
  // A full PAN / CVV reaching this action is rejected before any persistence call.
  const parsed = paymentSettingsSchema.safeParse({
    defaultCard: formData.get('defaultCard'),
    invoicesByEmail: formData.get('invoicesByEmail') ?? undefined
  });

  if (!parsed.success) {
    return withFieldErrors(parsed.error);
  }

  const recorded = await recordAccountRequest('payment_preferences', {
    defaultCard: parsed.data.defaultCard,
    invoicesByEmail: parsed.data.invoicesByEmail === 'on'
  });

  if (!recorded) {
    return {
      status: 'error',
      messageKey: 'settings.payments.errors.generic'
    };
  }

  await revalidateLocalePath('/user/settings');

  return {
    status: 'success',
    messageKey: 'settings.payments.success.request_received'
  };
}

export async function submitPrivacyRequest(
  _previous: AccountActionState = INITIAL_STATE,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = privacyRequestSchema.safeParse({
    requestType: formData.get('requestType')
  });

  if (!parsed.success) {
    return {
      status: 'error',
      messageKey: 'settings.privacy.errors.generic'
    };
  }

  const { requestType } = parsed.data;

  const recorded = await recordAccountRequest('privacy_request', {
    requestType
  });

  if (!recorded) {
    return {
      status: 'error',
      messageKey: 'settings.privacy.errors.generic'
    };
  }

  await revalidateLocalePath('/user/settings');

  return {
    status: 'success',
    messageKey:
      requestType === 'export'
        ? 'settings.privacy.success.export_request_received'
        : 'settings.privacy.success.delete_request_received'
  };
}

export const accountActionInitialState = INITIAL_STATE;
