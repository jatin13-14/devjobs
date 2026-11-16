import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '0.0.0.0' },
  test: {
    // Keep DOM/style work bounded alongside the isolated browser runners.
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
