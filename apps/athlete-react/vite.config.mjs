import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, '../..');

export default defineConfig({
  root: rootDir,
  base: '/athlete/',
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    outDir: resolve(rootDir, '../../dist/athlete'),
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return null;
          if (id.includes('react-dom')) return 'react-dom';
          if (id.includes('/react/')) return 'react';
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.js',
    include: [
      './**/*.test.{js,jsx,mjs}',
      '../../packages/shared-web/**/*.test.{js,jsx,mjs}',
    ],
  },
});
