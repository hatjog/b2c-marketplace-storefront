import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // v1.7.0 Story 2.1 review fix: explicit JSX automatic transform so component
  // tests do not need to import `React` and can call function components
  // directly (the previous default left tests in classic JSX transform mode
  // referencing an undefined `React` global at runtime, which caused the
  // pre-existing Skeleton.test.tsx to silently fail and prevented adding
  // Button/Badge/Chip tests for the AC3 state-coverage finding).
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    env: {
      MEDUSA_BACKEND_URL: 'http://localhost:9002',
      STOREFRONT_BASE_URL: 'http://localhost:3001',
    },
  },
} as any);
