import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: the Vite server proxies /api and /socket.io to the Express server, so the
// browser sees one origin (no CORS, first-party cookies).
const BACKEND = process.env.VITE_DEV_BACKEND || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/socket.io': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
});
