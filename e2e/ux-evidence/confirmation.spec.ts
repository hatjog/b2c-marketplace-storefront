/**
 * UX Evidence — Order Confirmation / Handoff (Story v170-2-10, Phase A)
 *
 * Covers: /order/confirmation/[id] at 375, 768, 1440
 * Checks: playwright-screenshot, axe
 *
 * Phase A: specs authored; live run deferred to Phase B.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  assertTrackedEvidenceArtifact,
  buildCommand,
  emitMeta,
  MARKET_ID,
  RELEASE_ID,
  resolveEvidenceArtifactPath,
  resolveGitSha,
  writeAxeReport
} from './_helpers/metadata';

const CONFIRMATION_PATH = '/order/confirmation/test-order-id';

test.describe('Confirmation — screenshot coverage', () => {
  test('confirmation PL screenshot', async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440;
    if (![375, 768, 1440].includes(viewport)) test.skip();

    await page.goto(CONFIRMATION_PATH);
    await page.waitForLoadState('networkidle');

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/confirmation.${viewport}.pl.png`;
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 });

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: 'storefront',
      role: 'customer',
      path: '/order/confirmation/[id]',
      path_slug: 'confirmation',
      viewport,
      locale: 'pl',
      check: 'playwright-screenshot',
      ac_ref: 'AC-UX13-01',
      artifact_path: screenshotPath,
      command: buildCommand('confirmation.spec.ts', testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: 'PASS'
    });
  });

  test('confirmation axe at 375', async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440;
    if (viewport !== 375) test.skip();

    await page.goto(CONFIRMATION_PATH);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blockers = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical'
    );

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: 'storefront',
      role: 'customer',
      path: '/order/confirmation/[id]',
      path_slug: 'confirmation',
      viewport,
      locale: 'pl',
      check: 'axe',
      ac_ref: 'AC-UX13-01',
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/confirmation.${viewport}.pl.axe.json`,
      command: buildCommand('confirmation.spec.ts', testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: blockers.length === 0 ? 'PASS' : 'FAIL'
    });
    expect(blockers).toHaveLength(0);
  });
});

/**
 * ── v1.15.0 Story 3.7 (AC4, AC5) — NOWE STANY POWIERZCHNI ──────────────────
 *
 * Trzy stany, których ta powierzchnia przed Story 3.7 nie miała: lista N
 * zamówień, sukces częściowy oraz STAN TERMINALNY PORAŻKI. Każdy dostaje
 * własny przebieg axe i własny artefakt — raport dla stanu porażki jest
 * OSOBNY, bo to on jest tu nowy.
 *
 * `page.route()` przechwytuje `/api/v1/*` i jest tu DOPUSZCZALNY: karty
 * zamówień są komponentami klienckimi i fetchują z przeglądarki. NIE MOCKUJE
 * SSR — rozwinięcie zakupu w kolekcję dzieje się serwerowo (mostek
 * `GET /store/carts/:id/completed-order`), więc kardynalność listy w tych
 * przebiegach pochodzi z REALNEGO backendu, nie z tych stubów. Kardynalność
 * mierzona bez backendu jest w suicie jednostkowej
 * (`ConfirmationPageContent/__tests__/confirmation-cardinality-render.test.tsx`).
 *
 * UWAGA do stanu zastanego tego pliku: `CONFIRMATION_PATH` powyżej wskazuje
 * `/order/confirmation/[id]`, a realna trasa to `/[locale]/order/[id]/confirmed`.
 * Przebiegi Story 3.7 używają trasy realnej; poprawienie ścieżki w przebiegach
 * v1.7.0 nie należy do zakresu tej story.
 */

/**
 * WARUNEK WEJŚCIA (review-fix MEDIUM-4): `GP_E2E_PURCHASE_ID` musi wskazywać
 * REALNY koszyk z domkniętymi zamówieniami.
 *
 * Rozwinięcie zakupu w kolekcję dzieje się SERWEROWO (`page.tsx` →
 * `resolveConfirmationPurchase` → mostek `GET /store/carts/:id/completed-order`),
 * więc `page.route()` z tego pliku go NIE dotyka. Bez tej zmiennej strona
 * wyrenderuje `confirmation-purchase-not-found`, a `waitForSelector` padnie po
 * 30 s × 5 testów — pięć czerwonych, które wyglądają na regresję Story 3.7,
 * a są brakiem fixture'u. Dokładnie ta klasa mylnej diagnozy kosztowała już tę
 * falę jeden przebieg (pusty submoduł przeczytany jako „kod nie istnieje").
 *
 * Skąd wziąć wartość: identyfikator koszyka z domkniętego zakupu
 * wielosprzedawcowego (`cart_...`) — ten sam segment, który niesie `return_url` 3DS.
 */
const PURCHASE_ID = process.env.GP_E2E_PURCHASE_ID;
const CONFIRMED_PATH_37 = `/pl/order/${PURCHASE_ID ?? 'cart_e2e_confirmation'}/confirmed`;

type ConfirmationScenario = {
  slug: string;
  acRef: string;
  /** Status z `/api/v1/orders/{id}/payment-status`. */
  paymentStatus: string;
  /** Kolekcja uprawnień albo HTTP 502 (awaria odczytu — AD-19). */
  entitlements: Array<{ status: string }> | { httpStatus: number };
  /** Selektor, którego OBECNOŚĆ dowodzi, że stan naprawdę się wyrenderował. */
  proofSelector: string;
  terminal: boolean;
};

const STORY_37_SCENARIOS: ConfirmationScenario[] = [
  {
    slug: 'confirmation-37-delivered',
    acRef: 'AC-3.7-04-positive',
    paymentStatus: 'paid',
    entitlements: [{ status: 'issued' }],
    proofSelector: '[data-pipeline-status="email_sent"]',
    terminal: true
  },
  {
    slug: 'confirmation-37-delivery-failed',
    acRef: 'AC-3.7-04-negative',
    paymentStatus: 'paid',
    // `dead_lettered` jest realnym, TERMINALNYM stanem ledgera dostarczeń
    // (`voucher-delivery/delivery-state.ts`). Przed Story 3.7 mapował się na
    // `unknown`, a `unknown` renderował spinner i odpytywał bez końca.
    entitlements: [{ status: 'dead_lettered' }],
    proofSelector: '[data-testid="order-terminal-delivery-failed"]',
    terminal: true
  },
  {
    slug: 'confirmation-37-payment-failed',
    acRef: 'AC-3.7-03',
    paymentStatus: 'failed_nonretryable',
    entitlements: [],
    proofSelector: '[data-testid="order-terminal-payment-failed"]',
    terminal: true
  },
  {
    slug: 'confirmation-37-read-degraded',
    acRef: 'AC-3.7-03',
    paymentStatus: 'paid',
    entitlements: { httpStatus: 502 },
    proofSelector: '[data-testid="order-read-degraded"]',
    terminal: false
  }
];

async function stubConfirmationApis(
  page: import('@playwright/test').Page,
  scenario: ConfirmationScenario
) {
  await page.route(/\/api\/v1\/orders\/[^/]+$/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'order_e2e',
        display_id: 'E2E-37',
        payment_status: 'captured',
        updated_at: '2026-08-08T10:00:00.000Z',
        customer_id: 'cus_e2e',
        masked_email: 'm***a@example.test',
        is_guest_checkout: false,
        currency_code: 'PLN',
        item_total: 10000,
        shipping_total: 0,
        tax_total: 2300,
        total: 12300,
        items: [],
        shipping_methods: [{ id: 'ship_e2e', name: 'email' }]
      })
    })
  );

  await page.route('**/api/v1/orders/*/payment-status', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: scenario.paymentStatus,
        last_checked_at: '2026-08-08T10:00:00.000Z',
        recommended_action_key: 'wait'
      })
    })
  );

  await page.route('**/api/v1/entitlements?*', route => {
    if (Array.isArray(scenario.entitlements)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scenario.entitlements)
      });
    }
    return route.fulfill({
      status: scenario.entitlements.httpStatus,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'entitlements_read_failed' })
    });
  });
}

test.describe('Confirmation — Story 3.7 nowe stany (axe per stan)', () => {
  // Brak fixture'u = SKIP Z POWODEM, nigdy czerwień bez pomiaru.
  test.skip(
    !PURCHASE_ID,
    'wymaga realnego koszyka z domkniętymi zamówieniami — ustaw GP_E2E_PURCHASE_ID'
  );

  for (const scenario of STORY_37_SCENARIOS) {
    test(`${scenario.slug} axe at 375`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 1440;
      if (viewport !== 375) test.skip();

      await stubConfirmationApis(page, scenario);
      await page.goto(CONFIRMED_PATH_37);
      await page.waitForLoadState('networkidle');

      // Dowód, że mierzymy TEN stan, a nie stan domyślny: bez tej asercji axe
      // przebiegłby po spinnerze i świeciłby na zielono, nic nie mierząc.
      await page.waitForSelector(scenario.proofSelector, { timeout: 30_000 });

      const cards = page.locator('[data-testid="order-confirmation-card"]');
      await expect(cards).toHaveCount(2);
      if (scenario.terminal) {
        await expect(
          page.locator('[data-testid="order-confirmation-card"][data-poll-finished="true"]')
        ).toHaveCount(2);
      }
      const pollEvidence = await cards.evaluateAll(nodes =>
        nodes.map(node => ({
          order_id: (node as HTMLElement).dataset.orderId,
          pipeline_status: (node as HTMLElement).dataset.pipelineStatus,
          poll_finished: (node as HTMLElement).dataset.pollFinished,
          request_count: Number((node as HTMLElement).dataset.pollRequests ?? '0')
        }))
      );
      if (scenario.terminal) {
        expect(pollEvidence.every(entry => entry.poll_finished === 'true')).toBe(true);
        expect(pollEvidence.every(entry => entry.request_count > 0)).toBe(true);
      }

      const proofArtifactPath = resolveEvidenceArtifactPath(
        `_bmad-output/releases/v1.15.0/implementation-artifacts/evidence/3-7/axe/${scenario.slug}.${viewport}.pl.prod-proof.json`
      );
      writeAxeReport(proofArtifactPath, {
        scenario: scenario.slug,
        rendered_order_count: pollEvidence.length,
        terminal_expected: scenario.terminal,
        polling: pollEvidence,
        measured_at: new Date().toISOString()
      });
      assertTrackedEvidenceArtifact(proofArtifactPath);

      const results = await new AxeBuilder({ page })
        .include('[data-testid="order-confirmed-w1-07"]')
        .exclude('[aria-hidden="true"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blockers = results.violations.filter(
        v => v.impact === 'serious' || v.impact === 'critical'
      );

      const artifactPath = resolveEvidenceArtifactPath(
        `_bmad-output/releases/v1.15.0/implementation-artifacts/evidence/3-7/axe/${scenario.slug}.${viewport}.pl.axe.json`
      );

      // Raport MUSI mieć producenta, nie tylko deklarację ścieżki (HIGH-1).
      writeAxeReport(artifactPath, results);
      assertTrackedEvidenceArtifact(artifactPath);

      emitMeta({
        release_id: 'v1.15.0',
        market_id: MARKET_ID,
        surface: 'storefront',
        role: 'customer',
        path: '/[locale]/order/[id]/confirmed',
        path_slug: scenario.slug,
        viewport,
        locale: 'pl',
        check: 'axe',
        ac_ref: scenario.acRef,
        artifact_path: artifactPath,
        command: buildCommand('confirmation.spec.ts', testInfo.project.name),
        timestamp: new Date().toISOString(),
        git_sha: resolveGitSha(),
        result: blockers.length === 0 ? 'PASS' : 'FAIL'
      });

      expect(blockers).toHaveLength(0);
    });
  }

  test('stan terminalny porażki: widoczny focus i osiągalne „co dalej”', async ({
    page
  }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440;
    if (viewport !== 375) test.skip();

    await stubConfirmationApis(page, STORY_37_SCENARIOS[1]);
    await page.goto(CONFIRMED_PATH_37);
    await page.waitForSelector('[data-testid="order-terminal-delivery-failed"]', {
      timeout: 30_000
    });

    const cta = page.locator('[data-testid="order-terminal-cta"]').first();
    await expect(cta).toBeVisible();

    // Kolejność tabulacji MUSI dojść do wyjścia — stan terminalny bez
    // osiągalnego „co dalej” jest ślepym zaułkiem, nie stanem.
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await cta.evaluate(el => el === document.activeElement);
    }
    expect(reached).toBe(true);

    // Pierścień focusu musi być WIDOCZNY — mierzone na wyliczonym stylu
    // sfokusowanego elementu, nie na obecności klasy w kodzie.
    const outline = await cta.evaluate(el => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThan(0);

    const focusArtifactPath = resolveEvidenceArtifactPath(
      `_bmad-output/releases/v1.15.0/implementation-artifacts/evidence/3-7/axe/confirmation-37-delivery-failed-focus.${viewport}.pl.json`
    );
    // Ten sam brak co przy axe: bez tego zapisu artefakt AC5 nie istniał.
    writeAxeReport(focusArtifactPath, {
      cta_visible: true,
      reached_by_tab: reached,
      outline_width: outline.width,
      outline_style: outline.style
    });
    assertTrackedEvidenceArtifact(focusArtifactPath);

    emitMeta({
      release_id: 'v1.15.0',
      market_id: MARKET_ID,
      surface: 'storefront',
      role: 'customer',
      path: '/[locale]/order/[id]/confirmed',
      path_slug: 'confirmation-37-delivery-failed-focus',
      viewport,
      locale: 'pl',
      check: 'keyboard-focus',
      ac_ref: 'AC-3.7-05',
      artifact_path: focusArtifactPath,
      command: buildCommand('confirmation.spec.ts', testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: 'PASS'
    });
  });
});
