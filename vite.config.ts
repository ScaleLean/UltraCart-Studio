import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwind(),
    {
      name: 'studio-content-policy',
      transformIndexHtml() {
        const scripts = command === 'serve' ? "'self' 'unsafe-inline'" : "'self'";
        const connections = command === 'serve' ? "'self' ws://127.0.0.1:5178" : "'none'";
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: `default-src 'none'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${connections}; base-uri 'none'; form-action 'none'`,
            },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src/renderer', import.meta.url)) } },
  build: { outDir: 'dist/renderer', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
    watch: { ignored: ['**/release/**', '**/test-results/**', '**/.studio-data/**'] },
  },
}));
