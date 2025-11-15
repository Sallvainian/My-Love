import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Use base path only for production (GitHub Pages), not for development/testing
  base: mode === 'production' ? '/My-Love/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false, // Disable in dev to prevent stale code caching
        type: 'module',
      },
      includeAssets: ['icons/*.png', 'fonts/*.woff2'],
      manifest: {
        name: 'My Love - Daily Reminders',
        short_name: 'My Love',
        description: 'Daily love notes and memories',
        theme_color: '#FF6B9D',
        background_color: '#FFE5EC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      // IndexedDB operations are browser API calls (not HTTP requests),
      // so service worker caching strategies do NOT intercept them.
      // No navigateFallbackDenylist or exclusions needed for IndexedDB.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Don't cache navigation requests - always fetch fresh HTML
        navigateFallback: null,
        // Don't pre-cache JS/CSS to prevent stale code issues
        globIgnores: ['**/*.js', '**/*.css'],
        runtimeCaching: [
          {
            // App shell (JS/CSS) - Always fetch from network
            urlPattern: /\.(js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell-v1', // Versioned cache name
              networkTimeoutSeconds: 2,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60, // 1 minute cache - aggressive invalidation
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Static assets (images, fonts) - Cache First
            urlPattern: /\.(png|jpg|jpeg|svg|woff2|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
}));
