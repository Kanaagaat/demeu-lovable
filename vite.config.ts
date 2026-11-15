import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'demeu-offline-seed',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'data/seed.json', source: readFileSync(new URL('./src/data/seed.json', import.meta.url)) });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DEMEU', short_name: 'DEMEU', lang: 'ru',
        display: 'standalone', start_url: '/', scope: '/', id: '/',
        theme_color: '#6755B2', background_color: '#FFFCF9',
        icons: [
          { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,ico,woff,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/health$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          urlPattern: ({ url }) => /^\/api(?:\/|$)/.test(url.pathname) || url.pathname === '/health',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'demeu-api', networkTimeoutSeconds: 4,
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
          },
        }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
});
