import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import checker from 'vite-plugin-checker';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages deployment requires repository name as subpath
  // Use base path only in production, root path in development
  base: mode === 'production' ? '/My-Love/' : '/',
  build: {
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
    // Vite 8 bundles with Rolldown, which dropped the object form of
    // `output.manualChunks` and deprecated `rollupOptions` in favour of
    // `rolldownOptions`. `codeSplitting.groups` is the replacement: each group
    // keeps the chunk name the object form produced, and `includeDependenciesRecursively`
    // (on by default) still drags each package's own dependency subtree along with it.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React core. The trailing separator in the alternation is load-bearing —
            // a bare `react` would also swallow react-window and react-window-infinite-loader.
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/ },
            // Supabase (heavy, used mostly in settings/admin)
            {
              name: 'vendor-supabase',
              test: /[\\/]node_modules[\\/]@supabase[\\/]supabase-js[\\/]/,
            },
            // State management + storage
            { name: 'vendor-state', test: /[\\/]node_modules[\\/](zustand|idb|zod)[\\/]/ },
            // Animations (optional, can be lazy loaded)
            { name: 'vendor-animation', test: /[\\/]node_modules[\\/]framer-motion[\\/]/ },
            // Icons - tree-shakeable, but benefit from caching as separate chunk
            { name: 'vendor-icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/ },
          ],
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
        // Precache JS, CSS, and static assets — NOT HTML
        // HTML must stay out so PrecacheRoute doesn't intercept navigation requests
        // (NavigationRoute with NetworkFirst handles HTML instead)
        globPatterns: ['**/*.{js,css,png,jpg,jpeg,svg,woff2,ico}'],
        globIgnores: ['**/*.map', '**/*.html'],
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
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.SENTRY_RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
}));
