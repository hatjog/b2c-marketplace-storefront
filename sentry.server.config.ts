import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!dsn) {
  console.info('[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set. Server Sentry is disabled.');
} else {
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    initialScope: marketId
      ? {
          tags: {
            market_id: marketId
          }
        }
      : undefined
  });
}