import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Override tsconfig "jsx": "preserve" (needed by Next.js) for vitest/vite 8 OXC transformer
  oxc: {
    jsxRuntime: 'automatic',
    tsconfig: {
      override: {
        jsx: 'react-jsx',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
  },
});
