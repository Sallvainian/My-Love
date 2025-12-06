import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import checker from 'vite-plugin-checker';

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
    checker({ typescript: true }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      // With injectManifest, THIS is where precache config goes (not workbox section)
      // All runtime caching is handled in sw.ts
      injectManifest: {
        // Only precache static assets - NO JS/CSS/HTML
        // This ensures registerRoute(NetworkOnly) in sw.ts actually runs for code
        globPatterns: ['**/*.{png,jpg,jpeg,svg,woff2,ico}'],
        globIgnores: ['**/*.js', '**/*.css', '**/*.html'],
        // Force SW update on every build with timestamp revision
        additionalManifestEntries: [
          { url: 'index.html', revision: Date.now().toString() },
        ],
      },
      devOptions: {
        enabled: false,
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
      // NOTE: workbox section is intentionally omitted
      // With strategies: 'injectManifest', workbox options like runtimeCaching,
      // navigateFallback, skipWaiting, etc. are IGNORED.
      // All runtime caching behavior is controlled in sw.ts
    }),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
}));
