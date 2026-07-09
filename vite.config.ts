import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Main build: the extension's HTML surfaces (popup, options page, side panel).
 * These are ordinary Preact apps and are emitted as ES modules.
 *
 * The background service worker is built separately by
 * `vite.background.config.ts` as a single self-contained IIFE. It runs AFTER
 * this build with `emptyOutDir: false` so it is appended to the same `dist/`
 * folder.
 */
export default defineConfig({
  plugins: [preact()],
  // Relative base so the emitted HTML references its assets with paths that
  // resolve correctly inside the packaged extension (chrome-extension://<id>/...).
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        options: resolve(root, 'options.html'),
        sidepanel: resolve(root, 'sidepanel.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
