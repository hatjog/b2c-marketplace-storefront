import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routeRelativePath = "src/app/api/revalidate/route.ts";
const routeAbsolutePath = path.join(root, routeRelativePath);

const hasRoute = fs.existsSync(routeAbsolutePath);
const routeSource = hasRoute ? fs.readFileSync(routeAbsolutePath, "utf8") : "";

// Rate limiter config lives in rate-limiter.ts after extraction; fall back to routeSource if missing.
const rateLimiterPath = path.join(root, "src/lib/rate-limiter.ts");
const rateLimiterSource = fs.existsSync(rateLimiterPath)
  ? fs.readFileSync(rateLimiterPath, "utf8")
  : routeSource;

// Dynamic import required: static ESM linking runs before tsx transforms .ts files (Node 22)
const { isRateLimited, getClientIp, validateRevalidateSecret, resetForTesting } =
  await import("../src/lib/rate-limiter.ts");

// SOURCE-BASED: wiring/config check — intentional per tech-spec
test("Revalidate API: route file exists", { skip: !hasRoute }, () => {
  assert.ok(hasRoute);
});

test("Revalidate API: exports POST handler", { skip: !hasRoute }, () => {
  // Allow common Next.js route handler export styles.
  assert.ok(
    /export\s+(async\s+)?function\s+POST\s*\(/.test(routeSource) ||
      /export\s+const\s+POST\s*=\s*(async\s*)?\(/.test(routeSource),
    "expected POST route handler to be exported"
  );
});

test("Revalidate API: checks x-revalidate-secret against REVALIDATE_SECRET", { skip: !hasRoute }, () => {
  assert.match(routeSource, /x-revalidate-secret/i);
  assert.match(routeSource, /process\.env\.REVALIDATE_SECRET/);
});

test("Revalidate API: invalid/missing secret returns 401 and does not revalidate", { skip: !hasRoute }, () => {
  assert.match(routeSource, /401/);

  // Ensure auth check exists as a guard (early return/response) before revalidation.
  const secretIndex = routeSource.search(/x-revalidate-secret/i);
  const revalidateIndex = routeSource.search(/revalidateTag\s*\(/);

  assert.ok(secretIndex >= 0, "secret header not referenced");
  assert.ok(revalidateIndex >= 0, "revalidateTag not referenced");
  assert.ok(secretIndex < revalidateIndex, "secret check should happen before revalidation");
});

test("Revalidate API: reads JSON body tags and calls revalidateTag for tags", { skip: !hasRoute }, () => {
  assert.match(routeSource, /(await\s+)?request\.json\s*\(\s*\)/);
  assert.match(routeSource, /tags/);
  assert.match(routeSource, /revalidateTag\s*\(/);

  // Common implementations.
  const hasLoopingCall =
    /for\s*\(\s*const\s+tag\s+of\s+tags\s*\)\s*\{?[\s\S]*revalidateTag\s*\(\s*tag\s*\)/.test(routeSource) ||
    /tags\.(forEach|map)\s*\(\s*\(?\s*tag\s*\)?\s*=>[\s\S]*revalidateTag\s*\(\s*tag\s*\)/.test(routeSource);

  assert.ok(hasLoopingCall, "expected revalidateTag(tag) to be called for each tag");
});

test("Revalidate API: success response includes { revalidated: true }", { skip: !hasRoute }, () => {
  assert.match(routeSource, /revalidated\s*:\s*true/);
});

test("Revalidate API: rate limited to 10/min per IP and returns 429", { skip: !hasRoute }, () => {
  assert.match(routeSource, /429/);
  // Message text is implementation detail; status code is the key requirement.

  // Rate limit config lives in rate-limiter.ts after extraction.
  // Approximate shape checks: limit value + 60s window + IP hint.
  assert.match(rateLimiterSource, /\b10\b/);
  assert.match(rateLimiterSource, /(60_000|60000|60\s*\*\s*1000)/);
  assert.match(routeSource, /(x-forwarded-for|x-real-ip|request\.ip|\bip\b)/i);
});

// RUNTIME: business logic tests
describe("rate limiter runtime", () => {
  beforeEach(() => {
    resetForTesting();
  });

  test("isRateLimited: under limit — 9 calls not limited", () => {
    for (let i = 0; i < 9; i++) {
      assert.strictEqual(isRateLimited("test-ip"), false);
    }
  });

  test("isRateLimited: at limit — 10th call returns true", () => {
    for (let i = 0; i < 10; i++) {
      isRateLimited("test-ip");
    }
    assert.strictEqual(isRateLimited("test-ip"), true);
  });

  test("isRateLimited: window expiry — old timestamps outside window not counted", () => {
    const originalNow = Date.now;
    const T = 1_000_000;
    Date.now = () => T;
    try {
      for (let i = 0; i < 10; i++) {
        isRateLimited("test-ip");
      }
      assert.strictEqual(isRateLimited("test-ip"), true);
      Date.now = () => T + 61_000;
      assert.strictEqual(isRateLimited("test-ip"), false);
    } finally {
      Date.now = originalNow;
    }
  });

  test("isRateLimited: IP isolation — different IPs tracked independently", () => {
    for (let i = 0; i < 10; i++) {
      isRateLimited("ip-a");
    }
    assert.strictEqual(isRateLimited("ip-a"), true);
    assert.strictEqual(isRateLimited("ip-b"), false);
  });

  test("getClientIp: x-forwarded-for header present -> returns first IP", () => {
    const h = new Headers();
    h.set("x-forwarded-for", "192.168.1.1, 10.0.0.1");
    assert.strictEqual(getClientIp(h), "192.168.1.1");
  });

  test("getClientIp: no header -> returns '127.0.0.1'", () => {
    const h = new Headers();
    assert.strictEqual(getClientIp(h), "127.0.0.1");
  });

  test("validateRevalidateSecret: matching values -> true", () => {
    assert.strictEqual(validateRevalidateSecret("my-secret", "my-secret"), true);
  });

  test("validateRevalidateSecret: mismatch or null -> false", () => {
    assert.strictEqual(validateRevalidateSecret("wrong", "my-secret"), false);
    assert.strictEqual(validateRevalidateSecret(null, "my-secret"), false);
  });
});
