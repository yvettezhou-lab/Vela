import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Register manually so we can force Safari to bypass its HTTP cache
      // when checking for a new service worker.
      injectRegister: false,
      includeAssets: [
        'vela-icon-192.png',
        'vela-icon-512.png',
        'favicon-32.png',
      ],
      manifest: {
        name: 'Vela',
        short_name: 'Vela',
        description: 'Local-first travel ledger',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#efe8da',
        theme_color: '#efe8da',
        icons: [
          {
            src: '/vela-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/vela-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
