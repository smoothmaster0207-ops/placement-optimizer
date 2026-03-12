import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 5174,
    open: false
  },
  optimizeDeps: {
    exclude: ['glpk.js']
  }
});
