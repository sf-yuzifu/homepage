import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import viteCompression from 'vite-plugin-compression'
import viteImagemin from 'vite-plugin-imagemin'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    minify: 'esbuild'
  },
  plugins: [
    vue(),
    vueJsx(),
    viteImagemin({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false
      },
      optipng: {
        optimizationLevel: 7
      },
      mozjpeg: {
        quality: 50
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4
      },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox'
          },
          {
            name: 'removeEmptyAttrs',
            active: false
          }
        ]
      }
    }),
    VitePWA({
      mode: 'production',
      base: '/',
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ba-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Homepage',
        short_name: 'Homepage',
        description: "sf-yuzifu's homepage.",
        theme_color: '#128AFA',
        start_url: '/',
        id: 'Homepage',
        icons: [
          {
            src: '/favicon512.png',
            sizes: '512x512',
            purpose: 'any maskable'
          },
          {
            src: '/favicon144.png',
            sizes: '144x144'
          }
        ]
      }
    }),
    viteCompression({
      threshold: 10240 // the unit is Bytes
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
