import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Code dùng chung với Edge Functions (bộ tách SMS, bộ tách ghi nhanh...)
const sharedDir = fileURLToPath(new URL('../../supabase/functions/_shared', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@shared': sharedDir },
  },
  server: {
    // Monorepo: cho phép đọc cả thư mục gốc (node_modules của pnpm, supabase/functions/_shared)
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), sharedDir] },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Tự viết service worker (src/sw.ts) để nhận Web Push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // Cache cả font (woff2) và icon để mở app khi mất mạng vẫn đúng giao diện
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      injectRegister: 'auto',
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Titan',
        short_name: 'Titan',
        description: 'Quản lý chi tiêu cá nhân tự động',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f6f2',
        theme_color: '#f7f6f2',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
