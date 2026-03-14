import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  base: '/coach/',
  build: {
    outDir: resolve(rootDir, '../dist/coach'),
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return null;
          if (id.includes('react-dom')) return 'react-dom';
          if (id.includes('/react/')) return 'react';
          if (id.includes('@vercel/analytics') || id.includes('@vercel/speed-insights')) {
            return 'vercel-observability';
          }
          return 'vendor';
        },
      },
    },
  },
});
