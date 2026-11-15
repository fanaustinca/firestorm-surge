import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { port: 5190 },
  preview: { port: 4190 },
  build: { chunkSizeWarningLimit: 2000, target: 'es2022' },
});
