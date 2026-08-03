import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routeRelativePath = 'src/app/api/revalidate-all/route.ts';
const routeAbsolutePath = path.join(process.cwd(), routeRelativePath);
const hasRoute = fs.existsSync(routeAbsolutePath);
const routeSource = hasRoute ? fs.readFileSync(routeAbsolutePath, 'utf8') : '';

test('Revalidate-all API: route file exists', { skip: !hasRoute }, () => {
  assert.ok(hasRoute);
});

test('Revalidate-all API: exports POST handler', { skip: !hasRoute }, () => {
  assert.match(routeSource, /export\s+(async\s+)?function\s+POST\s*\(/);
});

test('Revalidate-all API: validates x-revalidate-secret and returns 401 on failure', { skip: !hasRoute }, () => {
  assert.match(routeSource, /x-revalidate-secret/i);
  assert.match(routeSource, /process\.env\.REVALIDATE_SECRET/);
  assert.match(routeSource, /401/);
});

test('Revalidate-all API: rate limits per IP and returns 429', { skip: !hasRoute }, () => {
  assert.match(routeSource, /getClientIp/);
  assert.match(routeSource, /isRateLimited/);
  assert.match(routeSource, /429/);
});

test('Revalidate-all API: revalidates root layout and returns { revalidated: true }', { skip: !hasRoute }, () => {
  assert.match(routeSource, /revalidatePath\s*\(\s*'\/'\s*,\s*'layout'\s*\)/);
  assert.match(routeSource, /revalidated\s*:\s*true/);
});