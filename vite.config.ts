import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages deployment requires repository name as subpath
  // Use base path only in production, root path in development
  base: mode === 'production' ? '/My-Love/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom'],
          // Supabase (heavy, used mostly in settings/admin)
          'vendor-supabase': ['@supabase/supabase-js'],
          // State management + storage
          'vendor-state': ['zustand', 'idb', 'zod'],
          // Animations (optional, can be lazy loaded)
          'vendor-animation': ['framer-motion'],
          // Icons - tree-shakeable, but benefit from caching as separate chunk
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // Explicitly inject SW registration
      srcDir: 'src',
      filename: 'sw.ts', // Renamed from sw-custom.ts to output sw.js
      strategies: 'injectManifest',
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
        // Only cache static assets, not app code
        globPatterns: ['**/*.{png,jpg,jpeg,svg,woff2,ico}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Serve index.html for all navigation requests (SPA routing support)
        // Use base path for GitHub Pages (/My-Love/) or root for development
        navigateFallback: mode === 'production' ? '/My-Love/index.html' : '/index.html',
        navigateFallbackDenylist: [/^\/api/, /\.(js|css|png|jpg|jpeg|svg|woff2|ico)$/],
        // Don't cache any JS/CSS/HTML - always fetch fresh to prevent stale code
        globIgnores: ['**/*.js', '**/*.css', '**/*.html'],
        runtimeCaching: [
          {
            // JS/CSS/HTML - Always fetch from network (no caching)
            urlPattern: /\.(js|css|html)$/,
            handler: 'NetworkOnly',
          },
          {
            // Static assets (images, fonts) - Cache First
            urlPattern: /\.(png|jpg|jpeg|svg|woff2|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-v2',
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
              cacheName: 'google-fonts-v2',
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
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
}));
