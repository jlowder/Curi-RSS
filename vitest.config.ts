import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['./server/__tests__/setup.ts'],
  },
});
