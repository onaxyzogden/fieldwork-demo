import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        /* React changes far less often than the app, so it gets its own
           file and stays cached across deploys (ADR 074). */
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'vendor';
          }
        },
      },
    },
  },
});
