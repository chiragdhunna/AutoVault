import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Main build: the extension's HTML surfaces (popup + options page).
 * These are ordinary Preact apps and are emitted as ES modules.
 *
 * The content script and the background service worker are built by
 * `vite.content.config.ts` and `vite.background.config.ts` respectively,
 * each as a single self-contained IIFE. They run AFTER this build with
 * `emptyOutDir: false` so they are appended to the same `dist/` folder.
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
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
