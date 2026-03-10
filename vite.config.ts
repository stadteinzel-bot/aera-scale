import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 4000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',           // ask user before updating SW
        includeAssets: ['icons/*.png', 'icons/*.svg', 'favicon.ico'],
        manifest: {
          name: 'AERA SCALE — Immobilienverwaltung',
          short_name: 'AERA SCALE',
          description: 'Enterprise-grade property management platform',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          id: 'aera-scale-pwa',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Dashboard', short_name: 'Dashboard', url: '/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Immobilien', short_name: 'Immobilien', url: '/#properties', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Finanzen', short_name: 'Finanzen', url: '/#finance', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          ],
          categories: ['business', 'finance', 'productivity'],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              // Google Fonts — stale-while-revalidate
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
            },
            {
              // Firebase Firestore/Auth — network-first (always fresh data)
              urlPattern: /^https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'firebase-cache', networkTimeoutSeconds: 10 },
            },
            {
              // Static assets — cache-first
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/,
              handler: 'CacheFirst',
              options: { cacheName: 'assets-cache', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } },
            },
          ],
        },
        devOptions: { enabled: false },   // disable SW in dev to avoid caching headaches
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
            'ui-libs': ['framer-motion', 'recharts', 'lucide-react'],
            'vendor': ['react', 'react-dom'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
