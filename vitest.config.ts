import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Override tsconfig "jsx": "preserve" (needed by Next.js) for vitest/vite 8 OXC transformer
  oxc: {
    tsconfig: {
      override: {
        jsx: 'react-jsx',
      },
    },
  } as any,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    env: {
      MEDUSA_BACKEND_URL: 'http://localhost:9000',
      STOREFRONT_BASE_URL: 'http://localhost:3000',
    },
  },
});
