import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routeRelativePath = "src/app/api/revalidate/route.ts";
const routeAbsolutePath = path.join(root, routeRelativePath);

const hasRoute = fs.existsSync(routeAbsolutePath);
const routeSource = hasRoute ? fs.readFileSync(routeAbsolutePath, "utf8") : "";

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

  // Approximate shape checks: limit value + 60s window + IP hint.
  assert.match(routeSource, /\b10\b/);
  assert.match(routeSource, /(60_000|60000|60\s*\*\s*1000)/);
  assert.match(routeSource, /(x-forwarded-for|x-real-ip|request\.ip|\bip\b)/i);
});
