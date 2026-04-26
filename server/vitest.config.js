import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{js,mjs,cjs}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**'
    ],
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
