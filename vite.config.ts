import { fileURLToPath, URL } from 'node:url'

import { load } from 'js-yaml'
import fs from 'fs'

import { defineConfig, type PluginOption, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { compression } from 'vite-plugin-compression2'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { VitePWA } from 'vite-plugin-pwa'
import type { ManifestOptions } from 'vite-plugin-pwa'
import { createHtmlPlugin } from 'vite-plugin-html'
import Font from 'vite-plugin-font'
import yaml from '@rollup/plugin-yaml'
import { l2dWebpPlugin } from './build/vite-plugin-l2d-webp.ts'
import { configValidatePlugin } from './build/validate-config.ts'
import { bioMarkdownPlugin } from './build/bio-markdown.ts'
import {
  ogImagesPlugin,
  PWA_SHOT_BIO_FILE,
  PWA_SHOT_HOME_FILE,
  PWA_SHOT_HEIGHT,
  PWA_SHOT_WIDTH
} from './build/og-images.ts'

type FontViteOptions = Parameters<typeof Font.vite>[0]

interface BuildConfig {
  title?: string
  favicon?: string
  author?: string
  description?: string
  keywords?: string
  url?: string
  iconfont?: string
  manifest?: Partial<ManifestOptions>
  /** 社交分享卡片（OG 图）源图，缺省 shots/zh/pic1.png / pic2.png */
  og?: {
    home?: string
    bio?: string
  }
}

const config = load(fs.readFileSync('_config.yaml', 'utf8')) as BuildConfig
const siteUrl = (config.url || '').replace(/\/+$/, '')

// iconfont 为远程地址（http(s):// 或协议相对 //）时取其 origin 供 preconnect；
// 默认本地 /js/iconfont.js 为 ''，index.html 据此跳过无效的第三方预热
const iconfontOrigin = (() => {
  const m = (config.iconfont?.trim() || '').match(/^(?:https?:)?\/\/([^/]+)/)
  return m ? `https://${m[1]}` : ''
})()

// PWA manifest 缺省补齐：display 默认 standalone（安装后独立窗口而非浏览器标签页）；
// screenshots 缺省引用构建期由 og-images 同源生成的 1280×720 截图（Chrome 富安装对话框用），
// fork 在 _config.yaml manifest.screenshots 自定义时覆盖（图片须放 public/，构建会校验存在性）
const pwaManifest: Partial<ManifestOptions> = {
  display: 'standalone',
  ...config.manifest,
  screenshots: config.manifest?.screenshots ?? [
    {
      src: `/${PWA_SHOT_HOME_FILE}`,
      sizes: `${PWA_SHOT_WIDTH}x${PWA_SHOT_HEIGHT}`,
      type: 'image/jpeg',
      form_factor: 'wide'
    },
    {
      src: `/${PWA_SHOT_BIO_FILE}`,
      sizes: `${PWA_SHOT_WIDTH}x${PWA_SHOT_HEIGHT}`,
      type: 'image/jpeg',
      form_factor: 'wide'
    }
  ]
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  const plugins: PluginOption[] = [
    configValidatePlugin(),
    bioMarkdownPlugin(),
    vue(),
    Font.vite({
      css: {
        fontFamily: 'Resource Han Rounded CN'
      }
    } as FontViteOptions),
    createHtmlPlugin({
      inject: {
        data: {
          title: config.title,
          favicon: config.favicon,
          author: config.author,
          themeColor: config.manifest?.theme_color,
          description: config.description,
          keywords: config.keywords,
          // 远程 iconfont 的 origin（本地内置时为 ''，模板据此跳过 preconnect）
          iconfontOrigin,
          // 站点规范地址（去除尾部斜杠），供 og:image/og:url/canonical 拼绝对 URL
          siteUrl,
          ogImage: siteUrl ? `${siteUrl}/og-home.jpg` : '/og-home.jpg'
        }
      }
    }),
    ViteImageOptimizer({
      png: {
        quality: 85
      },
      jpeg: {
        quality: 85
      },
      jpg: {
        quality: 85
      },
      webp: {
        quality: 85
      },
      svg: {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false
              }
            }
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
        // SPA 导航回退（navigateFallback 默认为 index.html）不拦截静态资源直链：
        // URL 带文件扩展名时不返回 index.html，直接走网络，避免图片/媒体/CSS 直链被回退成首页
        navigateFallbackDenylist: [/\.[a-zA-Z0-9]{1,10}(\?.*)?$/],
        runtimeCaching: [
          // 动态接口（音乐信息等）：网络优先，超时或失败时回退缓存，最长保留 1 天
          {
            urlPattern: /^https:\/\/api\.injahow\.cn\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'music-api-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 第三方静态资源 CDN（iconfont）：缓存优先，内容基本不变
          {
            urlPattern: /^https:\/\/at\.alicdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 静态资源（Live2D 骨骼/图集/贴图/语音、图片、视频、字体）：缓存优先
          // 只匹配本站资源目录与根目录文件，避免拦截第三方站点的同名资源
          // 注意：带查询串的请求（如网易云音频流）不匹配此规则，直接走网络
          {
            urlPattern:
              /^https?:\/\/[^/]+\/(?:(?:assets|img|l2d|shitim|cursors)\/[^?#]+|[^/?#]+)\.(?:png|jpe?g|webp|gif|svg|skel|atlas|mp3|mp4|webm|mov|woff2?|cur)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-cache',
              expiration: {
                maxEntries: 256,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: pwaManifest
    }),
    compression({
      threshold: 10240 // the unit is Bytes
    }),
    // 须在 viteCompression 之后注册，closeBundle 时先转 WebP 再 gzip 新产物
    l2dWebpPlugin(),
    yaml(),
    ogImagesPlugin(siteUrl, config.og)
  ]

  if (mode === 'analyze') {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false
      })
    )
  }

  return {
    // 生产环境剔除调试输出（保留 console.error 以便线上排障）
    esbuild: {
      drop: ['debugger'],
      pure: ['console.log', 'console.info', 'console.warn']
    },
    build: {
      assetsInlineLimit: 0,
      minify: 'esbuild',
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return

            const pkg = id.toString().split('node_modules/')[1].split('/')[0]

            // Vue 框架核心
            if (['vue', 'vue-router', '@vue'].includes(pkg)) return 'vue-core'
            // PIXI 渲染引擎与 Spine 骨骼动画
            if (
              [
                'pixi.js',
                '@pixi',
                '@esotericsoftware',
                'eventemitter3',
                'earcut',
                'ismobilejs'
              ].includes(pkg)
            )
              return 'pixi'
            // Arco 组件库及其内部依赖
            if (
              [
                '@arco-design',
                'dayjs',
                'number-precision',
                'b-tween',
                'b-validate',
                'compute-scroll-into-view',
                'scroll-into-view-if-needed',
                'resize-observer-polyfill'
              ].includes(pkg)
            )
              return 'arco'
            // 音视频播放
            if (['aplayer', 'howler'].includes(pkg)) return 'media'
            // BA 点击特效（桌面按需动态 import，独立 chunk）
            if (pkg === 'ba-click-fx') return 'click-fx'
            // 其余第三方依赖合并为一个 vendor chunk，避免按包拆出过碎的文件
            return 'vendor'
          }
        }
      }
    },
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
