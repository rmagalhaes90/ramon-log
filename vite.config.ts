import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'app-v4',
  publicDir: 'public',
  base: './',
  build: { outDir: '../dist-v4', emptyOutDir: true, sourcemap: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: { reporter: ['text', 'html'] }
  }
});
