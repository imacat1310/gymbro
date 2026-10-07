import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app under /<repo>/; set by the deploy workflow (ADR-003).
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'GymBro',
        short_name: 'GymBro',
        description: 'AI personal trainer: equipment scan, posture scan, plans, form check, tracking.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Pose runtime + models are large: cache on first use instead of at install.
        globIgnores: ['mediapipe/**', 'models/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(mediapipe\/wasm|models)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pose-assets',
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version) },
  server: { host: true },
})
