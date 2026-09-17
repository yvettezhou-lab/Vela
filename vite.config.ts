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
      injectRegister: 'auto',
      includeAssets: [
        '10D69AAA-D679-43CD-B511-947B2737ADE2.png',
        '896DCF5B-31E2-44AA-ADEB-1A9E019FC6FC.png',
        'E338C85B-A1F5-4DB3-9C3C-E03DC47C6380.png',
        'quick-entry.svg',
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
            src: '/896DCF5B-31E2-44AA-ADEB-1A9E019FC6FC.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/896DCF5B-31E2-44AA-ADEB-1A9E019FC6FC.png',
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
