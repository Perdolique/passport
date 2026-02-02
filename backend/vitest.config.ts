import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    globals: true,
    testTimeout: 5000,
    hookTimeout: 10_000,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      enabled: false,
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'src/index.ts'],
    },
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.url, './src'),
    },
  },
});
