/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    exclude: [
      '**/archive/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.config.*',
      '**/coverage/**',
      '**/server/**'
    ],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Use single thread for Windows compatibility
    pool: 'threads',
    singleThread: true,
    isolate: false,
    // Increase timeout for Windows
    testTimeout: 30000,
    // Mock CSS imports
    css: false,
  },
  // CSS handling for tests
  css: {
    modules: {
      classNameStrategy: 'non-scoped'
    }
  }
});