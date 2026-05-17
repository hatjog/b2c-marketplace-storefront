# DEV AGENT RECORD — Story 1.5 v1.8.0 Payment Status Surface 6 States

## Cross-story discrepancy #B (backend status vocab)

Backend route (Story 1.3) currently returns 5-state vocab: `paid | pending_psp_confirmation | failed | support_required | expired`. Story 1.5 introduces 6 states: `paid | pending_psp | failed_retryable | failed_nonretryable | expired | support_required`.

FE adapter (`payment-status-v180-adapter.ts`) maps backward-compat:
- `pending_psp_confirmation` → `pending_psp`
- `failed` (without `failure_code`) → `failed_retryable`
- `failed` (with `failure_code`) → `failed_nonretryable`
- New 6-state vocab → pass-through

Full 6-state support including `failed_nonretryable` disambiguation requires backend update to Story 1.3 route to include `failure_code` field. Until then, all legacy `failed` responses without `failure_code` are mapped to `failed_retryable` (safe default — customer can retry).

## CrossActorHandoff status

Component `<CrossActorHandoff>` did not exist in the codebase. Epic 0 Story 0.15 implementation covered lint rules, not this React component. Created here as a shared presentational component in `src/components/molecules/CrossActorHandoff/`. Marked as blocker per story instructions — substitute implementation pending architect ratification.

No barrel export added to avoid server/client bundle leakage (per storefront CLAUDE.md pułapki). Import is direct path in PaymentStatusV180.

## Visual regression baseline

Visual snapshot baseline infrastructure is joint with Epic 3 Story 3.8 (visual regression harness). Not present in Sprint 2 environment. Component tests are green for structure/a11y; visual snapshot gate is Story 3.8-owned.

## Auto-redirect behavior

`paid` state auto-redirects to `/order/${orderId}/confirmed` after 2s. This is cancelled when:
1. `prefers-reduced-motion: reduce` is set
2. Focus is on the CTA link at redirect time

The redirect uses `router.push` from next/navigation — no hard navigation.

## Poll interval

`usePaymentStatusPoll` uses fixed 5s interval (no backoff) per EDP9 spec requirement. Max wall-clock 10 min, then transitions to `expired`. Second-tier threshold 90s per UX SSOT §8.3.

## Files created

- `src/lib/payment/payment-status-v180-adapter.ts` — 6-state adapter with backward-compat mapping
- `src/hooks/usePaymentStatusPoll.ts` — fixed 5s poll hook with countdown + second-tier
- `src/components/molecules/CrossActorHandoff/CrossActorHandoff.tsx` — dual-actor transparency component
- `src/components/sections/PaymentStatusV180/PaymentStatusV180.tsx` — main 6-state client component
- `src/app/[locale]/(main)/order/[id]/payment-status/__tests__/payment-status-v180.test.tsx` — vitest suite
- `messages/pl.json` — v1.8.0 payment_status keys added
- `messages/en.json` — v1.8.0 payment_status keys added

## Files modified

- `src/app/[locale]/(main)/order/[id]/payment-status/page.tsx` — replaced `PaymentStatusPageContent` with `PaymentStatusV180`
