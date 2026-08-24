import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The game server holds the one game; Vite only serves the board. In
// development the two are separate processes, so the API is proxied across.
// In production the server serves dist/ itself and there is no proxy at all.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5170',
        changeOrigin: true,
        // Server-sent events must not be buffered, or the calendar would only
        // update when something else happened to flush the stream.
        configure: (proxy) => {
          proxy.on('proxyRes', (res) => {
            if (res.headers['content-type']?.includes('text/event-stream')) {
              res.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },
    },
  },
});
