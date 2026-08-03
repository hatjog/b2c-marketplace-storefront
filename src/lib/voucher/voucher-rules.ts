export interface VoucherRulesData {
  validityMonths: number | null;
  extension: {
    allowed: boolean;
    paid: boolean;
    feePct: number | null;
    maxExtensionMonths: number | null;
  };
  cancellation: string | null;
  refundChannel: string | null;
  noShow: string | null;
}

export interface VoucherRulesDisplay {
  heading: string;
  summary: string;
  validityLabel: string;
  validity: string;
  extensionLabel: string;
  extension: string;
  cancellationLabel: string;
  cancellation: string;
  refundLabel: string;
  refundChannel: string;
  noShowLabel: string;
  noShow: string;
}

type Dictionary = {
  heading: string;
  summary: string;
  validity: string;
  validityMonths: string;
  validityUnknown: string;
  extension: string;
  extensionPaid: string;
  extensionFree: string;
  extensionUnavailable: string;
  cancellation: string;
  cancellationFallback: string;
  refund: string;
  refundFallback: string;
  noShow: string;
  noShowFallback: string;
};

const DICTIONARY: Record<string, Dictionary> = {
  pl: {
    heading: 'Zasady vouchera',
    summary: 'Voucher ważny {months} miesięcy — termin realizacji ustalisz z salonem.',
    validity: 'Ważność',
    validityMonths: '{months} miesięcy od zakupu',
    validityUnknown: 'Termin ważności zgodnie z opisem oferty',
    extension: 'Przedłużenie',
    extensionPaid: 'Możesz przedłużyć voucher o {months} mies. za dopłatą {fee}%.',
    extensionFree: 'Możesz przedłużyć voucher o {months} mies. bez dopłaty.',
    extensionUnavailable: 'Przedłużenie vouchera nie jest dostępne.',
    cancellation: 'Anulowanie',
    cancellationFallback: 'Termin realizacji ustalasz bezpośrednio z salonem.',
    refund: 'Zwrot',
    refundFallback: 'Szczegóły zwrotu znajdziesz w regulaminie i potwierdzeniu zakupu.',
    noShow: 'Nieobecność',
    noShowFallback: 'Brak realizacji bez odwołania może wymagać kontaktu z salonem.',
  },
  en: {
    heading: 'Voucher rules',
    summary: 'Voucher valid for {months} months — book the date with the salon later.',
    validity: 'Validity',
    validityMonths: 'Valid for {months} months after purchase',
    validityUnknown: 'Validity period follows the offer details',
    extension: 'Extension',
    extensionPaid: 'You can extend the voucher by {months} months for an extra {fee}%.',
    extensionFree: 'You can extend the voucher by {months} months at no extra cost.',
    extensionUnavailable: 'Voucher extension is not available.',
    cancellation: 'Cancellation',
    cancellationFallback: 'The appointment date is arranged directly with the salon.',
    refund: 'Refund',
    refundFallback: 'Refund details are available in the terms and your purchase confirmation.',
    noShow: 'No-show',
    noShowFallback: 'Missing the appointment without cancelling may require direct salon follow-up.',
  },
  de: {
    heading: 'Gutscheinregeln',
    summary: 'Gutschein {months} Monate gültig — den Termin vereinbaren Sie später mit dem Salon.',
    validity: 'Gültigkeit',
    validityMonths: '{months} Monate ab Kauf gültig',
    validityUnknown: 'Die Gültigkeit richtet sich nach den Angebotsdetails',
    extension: 'Verlängerung',
    extensionPaid: 'Sie können den Gutschein um {months} Monate gegen {fee}% Aufpreis verlängern.',
    extensionFree: 'Sie können den Gutschein um {months} Monate ohne Aufpreis verlängern.',
    extensionUnavailable: 'Eine Verlängerung des Gutscheins ist nicht verfügbar.',
    cancellation: 'Stornierung',
    cancellationFallback: 'Den Termin vereinbaren Sie direkt mit dem Salon.',
    refund: 'Rückerstattung',
    refundFallback: 'Details zur Rückerstattung finden Sie in den Bedingungen und Ihrer Bestellbestätigung.',
    noShow: 'Nichterscheinen',
    noShowFallback: 'Bei Nichterscheinen ohne Absage kann eine direkte Klärung mit dem Salon nötig sein.',
  },
  ua: {
    heading: 'Правила ваучера',
    summary: 'Ваучер дійсний {months} місяців — дату узгодите із салоном пізніше.',
    validity: 'Термін дії',
    validityMonths: '{months} місяців від дати покупки',
    validityUnknown: 'Термін дії визначається умовами пропозиції',
    extension: 'Продовження',
    extensionPaid: 'Ви можете продовжити ваучер на {months} міс. за доплату {fee}%.',
    extensionFree: 'Ви можете продовжити ваучер на {months} міс. без доплати.',
    extensionUnavailable: 'Продовження ваучера недоступне.',
    cancellation: 'Скасування',
    cancellationFallback: 'Дату візиту ви узгоджуєте безпосередньо із салоном.',
    refund: 'Повернення',
    refundFallback: 'Деталі повернення є в правилах та підтвердженні покупки.',
    noShow: 'Неявка',
    noShowFallback: 'Неявка без скасування може вимагати окремого контакту із салоном.',
  },
};

const DEFAULT_RULES: VoucherRulesData = {
  validityMonths: 12,
  extension: {
    allowed: false,
    paid: false,
    feePct: null,
    maxExtensionMonths: null,
  },
  cancellation: null,
  refundChannel: null,
  noShow: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function template(source: string, vars: Record<string, string | number | null>): string {
  return source.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

function dictionaryFor(locale: string): Dictionary {
  return DICTIONARY[locale] ?? DICTIONARY[locale.slice(0, 2)] ?? DICTIONARY.pl;
}

export function getDefaultVoucherRulesData(): VoucherRulesData {
  return { ...DEFAULT_RULES, extension: { ...DEFAULT_RULES.extension } };
}

export function normalizeVoucherRules(source: unknown): VoucherRulesData | null {
  const root = asRecord(source);
  if (!root) return null;

  const policySnapshot = asRecord(root.policy_snapshot);
  const entitlementProfile = asRecord(root.entitlement_profile);
  const entitlementPolicy = asRecord(entitlementProfile?.policy);
  const snapshotExtension = asRecord(policySnapshot?.extension);
  const profileExtension = asRecord(entitlementPolicy?.extension);
  const extension = snapshotExtension ?? profileExtension;

  const validityMonths =
    readNumber(root.validity_months) ??
    readNumber(policySnapshot?.validity_months) ??
    readNumber(entitlementProfile?.validity_months);

  const cancellation =
    readString(root.cancellation) ??
    readString(policySnapshot?.cancellation);

  const refundChannel =
    readString(root.refund_channel) ??
    readString(policySnapshot?.refund_channel);

  const noShow =
    readString(root.no_show) ??
    readString(policySnapshot?.no_show);

  const allowed = readBoolean(extension?.allowed) ?? false;

  return {
    validityMonths,
    extension: {
      allowed,
      paid: readBoolean(extension?.paid) ?? false,
      feePct: readNumber(extension?.fee_pct),
      maxExtensionMonths: readNumber(extension?.max_extension_months),
    },
    cancellation,
    refundChannel,
    noShow,
  };
}

export function buildVoucherRulesDisplay(
  input: VoucherRulesData | null | undefined,
  locale: string,
): VoucherRulesDisplay {
  const rules = input ?? getDefaultVoucherRulesData();
  const copy = dictionaryFor(locale);
  const months = rules.validityMonths;
  const extensionMonths = rules.extension.maxExtensionMonths;

  let extensionText = copy.extensionUnavailable;
  if (rules.extension.allowed && extensionMonths && extensionMonths > 0) {
    extensionText = rules.extension.paid && rules.extension.feePct !== null
      ? template(copy.extensionPaid, { months: extensionMonths, fee: rules.extension.feePct })
      : template(copy.extensionFree, { months: extensionMonths });
  }

  return {
    heading: copy.heading,
    summary: months
      ? template(copy.summary, { months })
      : copy.validityUnknown,
    validityLabel: copy.validity,
    validity: months
      ? template(copy.validityMonths, { months })
      : copy.validityUnknown,
    extensionLabel: copy.extension,
    extension: extensionText,
    cancellationLabel: copy.cancellation,
    cancellation: rules.cancellation ?? copy.cancellationFallback,
    refundLabel: copy.refund,
    refundChannel: rules.refundChannel ?? copy.refundFallback,
    noShowLabel: copy.noShow,
    noShow: rules.noShow ?? copy.noShowFallback,
  };
}
