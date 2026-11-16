import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5190 },
  preview: { port: 4190 },
  build: { chunkSizeWarningLimit: 2000, target: 'es2022' },
});
