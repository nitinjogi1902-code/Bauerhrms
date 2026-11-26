import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Do not force a reload while HR users may be editing attendance/payroll forms.
      // main.jsx asks the user before applying a waiting update.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'hrsync-logo.webp'],
      manifest: {
        id: '/',
        name: 'HRSYNC HRMS',
        short_name: 'HRSYNC',
        description: 'HRSYNC Human Resource Management System',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f8ff',
        theme_color: '#202a75',
        prefer_related_applications: false,
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache only the application shell and static assets.
        // Supabase/backend API responses are intentionally NOT runtime-cached.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
