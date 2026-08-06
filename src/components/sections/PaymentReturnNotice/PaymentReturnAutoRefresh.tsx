'use client';

/**
 * v1.15.0 Story 3.6 review-fix (MEDIUM) — przywrócenie AUTOMATYCZNEGO
 * rozstrzygania stanu `pending_confirmation`.
 *
 * ── Co się zepsuło ─────────────────────────────────────────────────────────
 * Przed Story 3.6 strona powrotu ZAWSZE renderowała `PaymentStatusV180`, który
 * odpytuje status przez `usePaymentStatusPoll`. Po wprowadzeniu maszyny stanów
 * ten komponent renderuje się wyłącznie przy `state === 'confirmed'`, a dla
 * pozostałych stanów wchodzi statyczny `PaymentReturnNotice` — bez żadnego
 * odpytywania, z komunikatem „odśwież ją za chwilę". Najbardziej dotknięty jest
 * przypadek, dla którego to odpytywanie w ogóle powstało: asynchroniczny push
 * BLIK/P24, gdzie zamówienie powstaje z opóźnieniem i wcześniej rozstrzygało
 * się samo. Utrata istniejącego odpytywania nie jest odłożeniem funkcji do
 * Story 3.7 — jest regresją i tu jest cofnięta.
 *
 * ── Dlaczego `router.refresh()`, a nie drugi poller ────────────────────────
 * Rozstrzygnięcie stanu należy do serwera (`resolvePaymentReturn`), a strona
 * jest `force-dynamic`. Odświeżenie route'u przepuszcza ten sam serwerowy
 * odczyt jeszcze raz — nie duplikuje maszyny stanów po stronie klienta i nie
 * dokłada drugiego źródła prawdy o statusie płatności.
 *
 * Odpytywanie jest OGRANICZONE: stała liczba prób, a nie pętla bez końca.
 * Po wyczerpaniu prób zostaje ręczna akcja z `PaymentReturnNotice` — cisza po
 * stronie serwera nie zamienia się w nieskończone kręcenie w przeglądarce.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export interface PaymentReturnAutoRefreshProps {
  /** Ile razy odświeżyć, zanim oddamy sterowanie użytkowniczce. */
  maxAttempts?: number;
  /** Odstęp między próbami (ms). */
  intervalMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_INTERVAL_MS = 3000;

export function PaymentReturnAutoRefresh({
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  intervalMs = DEFAULT_INTERVAL_MS
}: PaymentReturnAutoRefreshProps) {
  const router = useRouter();
  const attemptsRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (attemptsRef.current >= maxAttempts) {
        clearInterval(timer);
        return;
      }
      attemptsRef.current += 1;
      router.refresh();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [router, maxAttempts, intervalMs]);

  // Nośnik pomiaru dla testów E2E/renderu: obecność atrybutu jest sygnałem, że
  // odpytywanie DZIAŁA na tej powierzchni, a nie że komponent istnieje w repo.
  return (
    <span
      data-testid="payment-return-auto-refresh"
      data-poll-interval-ms={intervalMs}
      data-poll-max-attempts={maxAttempts}
      hidden
    />
  );
}
