import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'app-v4',
  publicDir: 'public',
  base: './',
  build: {
    outDir: '../dist-v4',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@firebase/auth')) return 'firebase-auth';
          if (id.includes('@firebase/firestore')) return 'firebase-firestore';
          if (id.includes('@firebase/storage')) return 'firebase-storage';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: { reporter: ['text', 'html'] },
  },
});
