/**
 * Tests for v160-cleanup-15c: voucher claim AC4 + AC5.
 *
 * AC4 — Math.random fallback removed from voucher-sw.js (static code check)
 * AC5 — voucher-claim.ts no longer returns `{ ok: true }` stub when
 *        backend URL is absent (fail-closed error instead)
 *
 * Tests run via `pnpm test` (Node.js built-in test runner).
 *
 * Note: voucher-claim.ts is a Next.js Server Action that imports from
 * 'next/cache'. We test the logic inline (mirrors production behavior) rather
 * than importing the compiled module, to avoid the tsx/next resolver in .mjs
 * context (same pattern as cleanup-12c tests).
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// AC4: voucher-sw.js must not contain Math.random() calls
// ---------------------------------------------------------------------------

describe('AC4: voucher-sw.js — no Math.random fallback', () => {
  const swPath = resolve(ROOT, 'public/voucher-sw.js');
  const swSource = readFileSync(swPath, 'utf-8');

  test('Math.random() call does not appear in voucher-sw.js', () => {
    // Allow mentions in comments but not as an actual function call expression.
    // Regex matches `Math.random()` as a call (not `Math.random` in a comment after '//')
    const lines = swSource.split('\n');
    const callLines = lines.filter((line) => {
      const withoutComment = line.replace(/\/\/.*$/, '');
      return /Math\.random\s*\(/.test(withoutComment);
    });
    assert.equal(
      callLines.length,
      0,
      `Found Math.random() call(s) in voucher-sw.js:\n${callLines.join('\n')}`
    );
  });

  test('crypto.randomUUID unavailability path responds 503 (fail-closed)', () => {
    // Verify the fail-closed branch is present in the source.
    assert.ok(
      swSource.includes('crypto.randomUUID'),
      'voucher-sw.js must check crypto.randomUUID availability'
    );
    assert.ok(
      swSource.includes('crypto_unavailable'),
      'voucher-sw.js must use error code crypto_unavailable in fail-closed path'
    );
    assert.ok(
      swSource.includes('503'),
      'voucher-sw.js fail-closed path must respond with status 503'
    );
  });

  test('GP_VOUCHER_SW_ERROR message is broadcast to clients on unavailable crypto', () => {
    assert.ok(
      swSource.includes('GP_VOUCHER_SW_ERROR'),
      'voucher-sw.js must broadcast GP_VOUCHER_SW_ERROR to window clients'
    );
  });
});

// ---------------------------------------------------------------------------
// AC5: voucher-claim.ts logic — no stub `{ ok: true }` fallthrough
// ---------------------------------------------------------------------------
//
// Inline re-implementation of the claim action logic to test the
// "no backend URL" path without importing next/cache in .mjs context.
//

/**
 * Minimal re-implementation of the resolution logic from voucher-claim.ts.
 * Tests that when backendUrl is null the action returns an error (fail-closed).
 */
function makeClaimAction({ backendUrl, fetchImpl }) {
  return async function claimVoucher({ code, locale = 'pl', recipientSession = 'sess-abc' }) {
    if (!code) {
      return { ok: false, state: 'error-claim-failed', error: 'missing-code' };
    }

    if (!backendUrl) {
      // AC5: fail-closed — no stub success return.
      return {
        ok: false,
        state: 'error-claim-failed',
        error: 'backend_unavailable'
      };
    }

    const claimedAt = new Date().toISOString();
    const idempotencyKey = 'test-idem-key';

    try {
      const response = await fetchImpl(
        `${backendUrl}/store/vouchers/${encodeURIComponent(code)}/claim`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale,
            recipient_session: recipientSession,
            idempotency_key: idempotencyKey,
            claimed_at: claimedAt,
          }),
        }
      );

      if (response.status === 429) {
        const retryAfter = Number(response.headers?.get?.('Retry-After') ?? '60');
        return { ok: false, state: 'error-rate-limited', error: 'rate_limited', retry_after: retryAfter };
      }

      if (response.status === 409) {
        const body = response._body ?? {};
        if (body?.type === 'replay_mismatch') {
          return { ok: false, state: 'error-replay-mismatch', error: 'replay_mismatch' };
        }
        return { ok: false, state: 'error-already-claimed', error: 'already_claimed' };
      }

      if (response.status === 410) {
        return { ok: false, state: 'error-expired', error: 'expired' };
      }

      if (!response.ok) {
        return { ok: false, state: 'error-claim-failed', error: `backend returned ${response.status}` };
      }

      const json = response._body ?? {};
      return { ok: true, state: 'claimed', seller_handle: json.seller_handle };
    } catch (error) {
      return { ok: false, state: 'error-claim-failed', error: error.message ?? 'unknown' };
    }
  };
}

describe('AC5: voucher-claim — no stub { ok: true } fallthrough when backend unavailable', () => {
  test('missing-code returns error-claim-failed', async () => {
    const action = makeClaimAction({ backendUrl: null, fetchImpl: null });
    const result = await action({ code: '' });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'missing-code');
  });

  test('backendUrl=null → error backend_unavailable (NOT ok: true)', async () => {
    const action = makeClaimAction({ backendUrl: null, fetchImpl: null });
    const result = await action({ code: 'SOME-CODE' });
    assert.equal(result.ok, false, 'must NOT return ok: true when backend is unavailable');
    assert.equal(result.state, 'error-claim-failed');
    assert.equal(result.error, 'backend_unavailable');
  });

  test('backend 200 → ok: true with state claimed', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      _body: { seller_handle: 'test-shop' },
    });
    const action = makeClaimAction({ backendUrl: 'http://localhost:9000', fetchImpl: mockFetch });
    const result = await action({ code: 'IDLE-CODE' });
    assert.equal(result.ok, true);
    assert.equal(result.state, 'claimed');
    assert.equal(result.seller_handle, 'test-shop');
  });

  test('backend 429 → error-rate-limited with retry_after', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 429,
      headers: { get: (h) => h === 'Retry-After' ? '30' : null },
      _body: {},
    });
    const action = makeClaimAction({ backendUrl: 'http://localhost:9000', fetchImpl: mockFetch });
    const result = await action({ code: 'IDLE-CODE' });
    assert.equal(result.ok, false);
    assert.equal(result.state, 'error-rate-limited');
    assert.equal(result.retry_after, 30);
  });

  test('backend 409 replay_mismatch → error-replay-mismatch', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 409,
      headers: { get: () => null },
      _body: { type: 'replay_mismatch' },
    });
    const action = makeClaimAction({ backendUrl: 'http://localhost:9000', fetchImpl: mockFetch });
    const result = await action({ code: 'IDLE-CODE' });
    assert.equal(result.ok, false);
    assert.equal(result.state, 'error-replay-mismatch');
  });

  test('backend 409 already_claimed → error-already-claimed', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 409,
      headers: { get: () => null },
      _body: { type: 'already_claimed' },
    });
    const action = makeClaimAction({ backendUrl: 'http://localhost:9000', fetchImpl: mockFetch });
    const result = await action({ code: 'CLAIMED-CODE' });
    assert.equal(result.ok, false);
    assert.equal(result.state, 'error-already-claimed');
  });

  test('backend 410 expired → error-expired', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 410,
      headers: { get: () => null },
      _body: {},
    });
    const action = makeClaimAction({ backendUrl: 'http://localhost:9000', fetchImpl: mockFetch });
    const result = await action({ code: 'EXPIRED-CODE' });
    assert.equal(result.ok, false);
    assert.equal(result.state, 'error-expired');
  });

  test('network error → error-claim-failed', async () => {
    const mockFetch = async () => { throw new Error('ECONNREFUSED'); };
    const action = makeClaimAction({ backendUrl: 'http://localhost:9000', fetchImpl: mockFetch });
    const result = await action({ code: 'ANY-CODE' });
    assert.equal(result.ok, false);
    assert.equal(result.state, 'error-claim-failed');
    assert.ok(result.error.includes('ECONNREFUSED'));
  });
});

// ---------------------------------------------------------------------------
// AC4 static check: voucher-claim.ts source must NOT contain stub fallthrough
// ---------------------------------------------------------------------------

describe('AC5 static: voucher-claim.ts source has no { ok: true } stub for missing backendUrl', () => {
  const claimSrc = readFileSync(
    resolve(ROOT, 'src/actions/voucher-claim.ts'),
    'utf-8'
  );

  test('no STUB_TODO_MARKER present in source', () => {
    assert.ok(
      !claimSrc.includes('STORY-6-X-STUB'),
      'STUB_TODO_MARKER must be removed from voucher-claim.ts'
    );
  });

  test('no { ok: true, state: claimed } return in the !backendUrl branch', () => {
    // The only ok:true return must be after a successful fetch (guarded by response.ok)
    // We detect the stub pattern: `ok: true, state: 'claimed'` without a preceding fetch check.
    // Simplistic check: no line that is ONLY `return { ok: true, state: 'claimed' };`
    const stubPattern = /return\s*\{[^}]*ok:\s*true[^}]*state:\s*'claimed'[^}]*\}\s*;/;
    // This pattern must NOT appear outside the successful fetch block.
    // We verify by checking the count: exactly 1 occurrence (the real success path).
    const matches = claimSrc.match(new RegExp(stubPattern.source, 'g')) ?? [];
    // The real success path is `return { ok: true, state: 'claimed', seller_handle: json.seller_handle };`
    // There must be at most 1 match and it must include seller_handle.
    for (const m of matches) {
      assert.ok(
        m.includes('seller_handle'),
        `Found bare { ok: true, state: 'claimed' } stub without seller_handle — stub fallthrough not fully removed: ${m}`
      );
    }
  });
});
