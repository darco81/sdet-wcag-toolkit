import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Browser-backed tests can be slow; keep the default timeout comfortable.
    testTimeout: 30_000,
  },
});
