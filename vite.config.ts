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
      // Register manually so Safari can be forced to refresh the service worker.
      injectRegister: false,
      includeAssets: [
        'apple-touch-icon.png',
        'favicon.svg',
      ],
      manifest: {
        name: 'Vela',
        short_name: 'Vela',
        description: 'Local-first travel ledger',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#efe8da',
        theme_color: '#172942',
        icons: [
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
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