import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Background service-worker build.
 *
 * Emitted as a single self-contained IIFE at `dist/background.js`. The manifest
 * declares it WITHOUT `"type": "module"`, so it loads as a classic worker
 * script — no import resolution or chunk files to worry about at runtime.
 */
export default defineConfig({
  // public/ is copied by the main (pages) build; don't duplicate it here.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome116',
    lib: {
      entry: resolve(root, 'src/background/service-worker.ts'),
      name: 'AutoVaultBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true,
      },
    },
  },
});
