import { defineConfig } from 'vite';

const apiTarget = process.env['API_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // В dev-режиме запросы /api/* уходят на игровой сервер без префикса.
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
