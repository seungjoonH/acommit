import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@acommit/core': path.resolve(__dirname, '../src/core'),
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    proxy: { '/api': 'http://localhost:3000' },
    historyApiFallback: true,
  },
});
