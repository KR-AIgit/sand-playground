import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/sand-playground/', // 깃허브 저장소 이름으로 정확히 고정
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '모래놀이터_JA★',
        short_name: '모래놀이터_JA★',
        start_url: '/sand-playground/',
        scope: '/sand-playground/',
        description: '지안이를 위한 재미있는 모바일 모래놀이터!',
        theme_color: '#2c2f33',
        background_color: '#2c2f33',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})
