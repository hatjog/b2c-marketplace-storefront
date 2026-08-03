import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
};

const exists = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath);
};

test('Sentry runtime config files exist', () => {
  assert.ok(exists('sentry.client.config.ts'));
  assert.ok(exists('sentry.server.config.ts'));
  assert.ok(exists('sentry.edge.config.ts'));
  assert.ok(exists('instrumentation.ts'));
  assert.ok(exists('instrumentation-client.ts'));
});

test('Client config has sampling, market tag and replay disabled', () => {
  const source = read('sentry.client.config.ts');

  assert.match(source, /tracesSampleRate\s*:\s*0\.1/);
  assert.match(source, /replaysSessionSampleRate\s*:\s*0/);
  assert.match(source, /market_id/);
  assert.match(source, /NEXT_PUBLIC_PAYLOAD_MARKET_ID/);
  assert.match(source, /NEXT_PUBLIC_SENTRY_DSN/);
  assert.match(source, /if\s*\(!dsn\)/);
});

test('Server and edge configs include market_id tag and DSN guard', () => {
  const serverSource = read('sentry.server.config.ts');
  const edgeSource = read('sentry.edge.config.ts');

  for (const source of [serverSource, edgeSource]) {
    assert.match(source, /market_id/);
    assert.match(source, /NEXT_PUBLIC_PAYLOAD_MARKET_ID/);
    assert.match(source, /NEXT_PUBLIC_SENTRY_DSN/);
    assert.match(source, /if\s*\(!dsn\)/);
    assert.match(source, /tracesSampleRate\s*:\s*0\.1/);
  }
});

test('next.config.ts uses withSentryConfig wrapper', () => {
  const source = read('next.config.ts');

  assert.match(source, /withSentryConfig/);
  assert.match(source, /export default withSentryConfig/);
  assert.doesNotMatch(source, /disableLogger\s*:/);
});

test('Server/edge instrumentation initializes Sentry and wires request error capture', () => {
  const source = read('instrumentation.ts');

  assert.match(source, /export\s+async\s+function\s+register\s*\(/);
  assert.match(source, /NEXT_PUBLIC_SENTRY_DSN/);
  assert.match(source, /if\s*\(!dsn\)/);
  assert.match(source, /Sentry\.init\(/);
  assert.match(source, /tracesSampleRate\s*:\s*0\.1/);
  assert.match(source, /market_id/);
  assert.match(source, /NEXT_PUBLIC_PAYLOAD_MARKET_ID/);
  assert.match(source, /export\s+const\s+onRequestError\s*=\s*Sentry\.captureRequestError/);
});

test('Client instrumentation initializes Sentry with replay disabled and market tag', () => {
  const source = read('instrumentation-client.ts');

  assert.match(source, /onRouterTransitionStart\s*=\s*Sentry\.captureRouterTransitionStart/);
  assert.match(source, /NEXT_PUBLIC_SENTRY_DSN/);
  assert.match(source, /if\s*\(!dsn\)/);
  assert.match(source, /Sentry\.init\(/);
  assert.match(source, /tracesSampleRate\s*:\s*0\.1/);
  assert.match(source, /replaysSessionSampleRate\s*:\s*0/);
  assert.match(source, /market_id/);
  assert.match(source, /NEXT_PUBLIC_PAYLOAD_MARKET_ID/);
});

test('.env.template includes required Sentry vars', () => {
  const source = read('.env.template');

  assert.match(source, /^NEXT_PUBLIC_SENTRY_DSN=/m);
  assert.match(source, /^SENTRY_AUTH_TOKEN=.*CI\/CD only/im);
});
