export type VoucherPipelineStatus =
  | 'pending_payment'
  | 'paid'
  | 'voucher_generating'
  | 'voucher_issued'
  | 'email_sent'
  | 'recipient_opened'
  | 'unknown';

export type EntitlementSignal = {
  status?: string | null;
};

export type StepState = 'done' | 'active' | 'future';

export interface ConfirmationStep {
  id: 'paid' | 'voucher_generating' | 'email_sent' | 'recipient_opened';
  state: StepState;
}

export interface ConfirmationStepperState {
  status: VoucherPipelineStatus;
  steps: readonly ConfirmationStep[];
  activeStepId: ConfirmationStep['id'] | null;
}

const STATUS_ALIASES: Record<string, VoucherPipelineStatus> = {
  paid: 'paid',
  pending_psp: 'pending_payment',
  pending_psp_confirmation: 'pending_payment',
  not_paid: 'pending_payment',
  awaiting: 'pending_payment',
  authorized: 'pending_payment',
  partially_authorized: 'pending_payment',
  voucher_generating: 'voucher_generating',
  voucher_generated: 'voucher_issued',
  voucher_issued: 'voucher_issued',
  email_sent: 'email_sent',
  recipient_opened: 'recipient_opened'
};

const ENTITLEMENT_STATUS_ALIASES: Record<string, VoucherPipelineStatus> = {
  issued: 'email_sent',
  delivered: 'email_sent',
  sent: 'email_sent',
  email_sent: 'email_sent',
  queued: 'voucher_generating',
  active: 'recipient_opened',
  opened: 'recipient_opened',
  recipient_opened: 'recipient_opened',
  partially_redeemed: 'recipient_opened',
  redeemed: 'recipient_opened',
  redeemed_partial: 'recipient_opened',
  redeemed_full: 'recipient_opened',
  settled: 'recipient_opened',
  closed: 'recipient_opened'
};

const STEP_ORDER: readonly ConfirmationStep['id'][] = [
  'paid',
  'voucher_generating',
  'email_sent',
  'recipient_opened'
];

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '***@***';

  const trimmed = email.trim();
  const [localRaw, domainRaw] = trimmed.split('@');
  if (!localRaw || !domainRaw) return '***@***';

  const local = localRaw.toLowerCase();
  const domain = domainRaw.toLowerCase();

  const localMasked =
    local.length <= 2
      ? `${local[0] ?? '*'}*`
      : `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${local[local.length - 1]}`;

  const domainParts = domain.split('.').filter(Boolean);
  if (domainParts.length === 0) return `${localMasked}@***`;

  const root = domainParts[0];
  const tld = domainParts.slice(1).join('.') || '*';
  const rootMasked =
    root.length <= 2
      ? `${root[0] ?? '*'}*`
      : `${root[0]}${'*'.repeat(Math.max(root.length - 2, 1))}${root[root.length - 1]}`;

  return `${localMasked}@${rootMasked}.${tld}`;
}

export function normalizeVoucherPipelineStatus(
  rawStatus: string | null | undefined
): VoucherPipelineStatus {
  if (!rawStatus) return 'unknown';
  const normalized = rawStatus.trim().toLowerCase();
  return STATUS_ALIASES[normalized] ?? 'unknown';
}

export function normalizeEntitlementPipelineStatus(
  rawStatus: string | null | undefined
): VoucherPipelineStatus | null {
  if (!rawStatus) return null;
  const normalized = rawStatus.trim().toLowerCase();
  return ENTITLEMENT_STATUS_ALIASES[normalized] ?? null;
}

export function deriveVoucherPipelineStatus(
  paymentStatusRaw: string | null | undefined,
  entitlements: EntitlementSignal[]
): VoucherPipelineStatus {
  const entitlementStatuses = entitlements
    .map(entitlement => normalizeEntitlementPipelineStatus(entitlement.status))
    .filter((status): status is VoucherPipelineStatus => Boolean(status));

  if (entitlementStatuses.includes('recipient_opened')) {
    return 'recipient_opened';
  }
  if (entitlementStatuses.includes('email_sent')) {
    return 'email_sent';
  }

  const paymentStatus = normalizeVoucherPipelineStatus(paymentStatusRaw);
  if (paymentStatus === 'voucher_issued') {
    return 'email_sent';
  }

  return paymentStatus;
}

function getActiveIndex(status: VoucherPipelineStatus): number | null {
  switch (status) {
    case 'pending_payment':
      return 0;
    case 'paid':
    case 'voucher_generating':
      return 1;
    case 'voucher_issued':
      return 2;
    case 'email_sent':
      return 3;
    case 'recipient_opened':
      return null;
    case 'unknown':
    default:
      // fail-soft for missing backend step-2/3/4 data
      return 1;
  }
}

function getCompletedThroughIndex(status: VoucherPipelineStatus): number {
  switch (status) {
    case 'pending_payment':
      return -1;
    case 'paid':
    case 'voucher_generating':
    case 'unknown':
      return 0;
    case 'voucher_issued':
      return 1;
    case 'email_sent':
      return 2;
    case 'recipient_opened':
      return 3;
    default:
      return 0;
  }
}

export function buildConfirmationStepperState(
  rawStatus: string | null | undefined
): ConfirmationStepperState {
  const status = normalizeVoucherPipelineStatus(rawStatus);
  const activeIndex = getActiveIndex(status);
  const completedThrough = getCompletedThroughIndex(status);

  const steps = STEP_ORDER.map((id, idx) => {
    let state: StepState = 'future';
    if (idx <= completedThrough) state = 'done';
    if (activeIndex === idx) state = 'active';
    return { id, state };
  });

  const activeStepId = activeIndex === null ? null : STEP_ORDER[activeIndex];

  return {
    status,
    steps,
    activeStepId
  };
}

export function shouldStopConfirmationPolling(status: VoucherPipelineStatus): boolean {
  return status === 'voucher_issued' || status === 'email_sent' || status === 'recipient_opened';
}

export function getGeneratingElapsedSeconds(generatingStartedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - generatingStartedAtMs) / 1000));
}

export function isSecondTierGenerating(elapsedSeconds: number, thresholdSeconds = 90): boolean {
  return elapsedSeconds >= thresholdSeconds;
}
