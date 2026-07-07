import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Content-script build.
 *
 * Emits a SINGLE self-contained IIFE at `dist/content.js` with no imports and
 * no code-splitting. This matters because the same file is used two ways:
 *   1. Declared statically in `content_scripts` for known ATS domains.
 *   2. Injected on demand via `chrome.scripting.executeScript({ files: ['content.js'] })`
 *      and `chrome.scripting.registerContentScripts({ js: ['content.js'] })`.
 * Both APIs require a classic (non-module) script, which an IIFE satisfies.
 *
 * All CSS is injected from JS (see src/content/highlight.ts), so there is no
 * separate stylesheet to manage.
 */
export default defineConfig({
  // public/ is copied by the main (pages) build; don't duplicate it here.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome116',
    lib: {
      entry: resolve(root, 'src/content/index.ts'),
      name: 'AutoVault',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        // Keep everything in one file; do not hash the name.
        extend: true,
        inlineDynamicImports: true,
      },
    },
  },
});
