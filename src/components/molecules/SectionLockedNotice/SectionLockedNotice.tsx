import type { ReactElement } from 'react';

/**
 * Powód, dla którego sekcja checkoutu jest zablokowana lub nie pozwala jeszcze
 * przejść dalej.
 *
 * ── Dlaczego ten komponent istnieje ─────────────────────────────────────────
 * `.bb-section-shell[data-locked='true']` (globals.css) nadaje sekcji
 * `pointer-events:none` + wyszarzenie. Wzorzec `locked` powstał jako stan
 * CZYSTO WIZUALNY, ale został nałożony na warunki semantyczne (adres, dostawa,
 * dane obdarowanej) — bez żadnego kontraktu na komunikat. Efekt: kupująca
 * widziała martwy, wyszarzony box i nie miała jak ustalić, czego brakuje.
 * Ten komponent JEST tym kontraktem: sekcja, która może być zablokowana,
 * renderuje powód.
 *
 * ── Dlaczego przyjmuje gotowy string, a nie klucz i18n ──────────────────────
 * Tłumaczy RODZIC, we własnym namespace (`checkout`, `seller.checkout`, …).
 * Dzięki temu komponent nie kupuje zależności od jednego namespace, a gate
 * `gp/i18n-namespace-key-resolves` widzi wywołanie `t()` tam, gdzie namespace
 * jest znany statycznie.
 *
 * ── UWAGA IMPLEMENTACYJNA (nie przenoś tego do środka sekcji) ───────────────
 * Notice MUSI być RODZEŃSTWEM `.bb-section-shell`, nigdy jego dzieckiem.
 * `opacity` na rodzicu tworzy kontekst stakingu, którego dziecko nie jest w
 * stanie cofnąć — komunikat wyrenderowany wewnątrz zablokowanej sekcji byłby
 * półprzezroczysty i wyszarzony, czyli dokładnie tak nieczytelny jak stan,
 * który ten komponent naprawia.
 */
export function SectionLockedNotice({
  reason,
  'data-testid': dataTestid = 'section-locked-notice'
}: {
  /** Gotowy, przetłumaczony powód. `undefined`/pusty ⇒ nic nie renderujemy. */
  reason?: string | null;
  'data-testid'?: string;
}): ReactElement | null {
  const visible = Boolean(reason?.trim());

  // Live region MUSI istnieć w DOM zanim pojawi się w niej tekst — region
  // montowany razem z treścią bywa przez czytniki ekranu pomijany. Skoro cała
  // racja bytu tego komponentu to „kupująca nie miała jak się dowiedzieć, co
  // jest nie tak", ścieżka dla technologii asystujących nie może być tą jedną,
  // która nadal milczy. Dlatego wrapper renderuje się zawsze, a przełącza się
  // wyłącznie jego zawartość.
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        visible
          ? // `--bb-surface-warm` NIE jest zdefiniowany w żadnym pliku tokenów
            // (jedyne inne użycie, globals.css, niesie fallback właśnie z tego
            // powodu) — bez fallbacku tło rozwiązałoby się do przezroczystego.
            'flex items-start gap-2 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-strong)] bg-[var(--bb-surface-warm,rgba(249,244,236,0.72))] px-4 py-3 text-sm text-[var(--text-primary)]'
          : 'hidden'
      }
      data-testid={visible ? dataTestid : undefined}
    >
      {visible && (
        <>
          <span aria-hidden="true">🔒</span>
          <span>{reason}</span>
        </>
      )}
    </div>
  );
}
