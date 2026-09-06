<script setup lang="ts">
import { Spine, SpineTexture } from '@esotericsoftware/spine-pixi-v8'
import * as PIXI from 'pixi.js'
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { tryCreatePixiApp } from '@/composables/spine/createPixiApp'

const { configs } = useConfig()
const LIVE2D_TIME_SCALE = 0.8

// 从配置中获取bio角色的Live2D配置
const bioConfig = computed(() => {
  if (
    !configs.value?.bio ||
    !Array.isArray(configs.value.bio.student) ||
    configs.value.bio.student.length === 0
  ) {
    return null
  }
  // 使用第一个bio角色配置
  return configs.value.bio.student[0]
})

const l2dContainer = ref<HTMLDivElement | null>(null)
let app: PIXI.Application | null = null
let spine: Spine | null = null
let isUnmounted = false // 组件卸载标记，await 加载期间卸载时阻止后续初始化
let skeletonAlias: string | null = null
let atlasAlias: string | null = null
/** atlas 页贴图在 Assets 中的 URL 键（生产构建可能为 .webp） */
let pageTextureUrls: string[] = []

onMounted(async () => {
  if (!l2dContainer.value) return

  // 等待配置加载
  const config = bioConfig.value
  if (!config) {
    console.warn('未找到bio Live2D配置')
    return
  }

  // 创建 PIXI 应用，初始大小设为容器大小
  const containerWidth = 2560
  const containerHeight = 1440

  // PIXI 8：应用只能异步 init 创建
  const pixiApp = await tryCreatePixiApp({
    width: containerWidth,
    height: containerHeight,
    backgroundAlpha: 0,
    // 同大厅：Spine 边缘靠图集 alpha 平滑，MSAA 收益极小；
    // 渲染倍率压到 1.5，降低低端 GPU 每帧光栅开销
    antialias: false,
    resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5)
  })
  if (!pixiApp || isUnmounted) return
  app = pixiApp

  l2dContainer.value.appendChild(pixiApp.canvas as HTMLCanvasElement)

  try {
    // 从配置构建资源路径
    const basePath = config.path
    const skelFile = config.skel
    const atlasFile = config.atlas

    // 添加资源（贴图页由 atlas 加载器按 .atlas 内声明自动加载，无需单独添加 png，
    // 否则同一张贴图会以不同缓存键重复下载/解码/占 GPU）
    skeletonAlias = `skeleton_${config.name}`
    atlasAlias = `atlas_${config.name}`
    // 贴图页在 Assets 缓存中的键（atlas 加载器以解析后的 URL 为键），供卸载时使用
    const textureStem = skelFile.replace(/\.skel$/i, '')
    pageTextureUrls = [`${basePath}${textureStem}.png`, `${basePath}${textureStem}.webp`]

    PIXI.Assets.add({ alias: skeletonAlias, src: basePath + skelFile })
    PIXI.Assets.add({ alias: atlasAlias, src: basePath + atlasFile })

    // 加载资源
    await PIXI.Assets.load([skeletonAlias, atlasAlias])

    // await 期间组件可能已被卸载，避免在已销毁的 app 上创建 Spine 导致泄漏
    if (isUnmounted) return

    // 创建 Spine 实例
    const loadedSpine = Spine.from({
      skeleton: skeletonAlias,
      atlas: atlasAlias
    })
    spine = loadedSpine

    // 添加到舞台
    pixiApp.stage.addChild(loadedSpine)

    // 等待一帧让 spine 初始化完成
    pixiApp.ticker.addOnce(() => {
      if (!spine) return

      // 设置缩放
      spine.scale.set(0.85) // 稍微留一点边距

      // 居中显示
      spine.x = containerWidth / 2
      spine.y = containerHeight

      // 播放默认动画
      if (spine.state) {
        spine.state.timeScale = LIVE2D_TIME_SCALE
        spine.state.setAnimation(0, 'Idle_01', true)
      }
    })
  } catch (error) {
    console.error('Live2D 加载失败:', error)
  }
})

// keep-alive 缓存（路由离开）期间停止/恢复 PIXI 渲染循环，避免不可见 canvas 空转耗电耗 GPU
// （onActivated 在首次挂载时也会触发，此时 app 可能尚未创建或 ticker 已在运行，判空后调用无副作用）
onActivated(() => {
  app?.ticker.start()
})

onDeactivated(() => {
  app?.ticker.stop()
})

// 清理函数 - 放在 setup 顶层
onUnmounted(() => {
  isUnmounted = true

  if (spine) {
    spine.destroy()
    spine = null
  }
  if (app) {
    // PIXI 8：baseTexture 选项更名为 textureSource
    app.destroy(true, { children: true, texture: true, textureSource: true })
    app = null
  }

  // 卸载资源并清理两层静态缓存（对齐 Background.vue 验证过的清理逻辑）：
  // 否则组件卸载后再次挂载（如 keep-alive 缓存被淘汰后重建）时，
  // Spine.from 会命中引用了已销毁贴图的缓存，渲染时报 alphaMode 空指针
  if (skeletonAlias && atlasAlias && pageTextureUrls.length > 0) {
    // 贴图页由 atlas 加载器以 URL 为键缓存，需一并卸载（开发 .png / 生产 .webp）
    PIXI.Assets.unload([skeletonAlias, atlasAlias, ...pageTextureUrls]).catch(() => {
      // 卸载失败不影响清理流程
    })
    // 清理 PIXI Cache 中的骨骼数据缓存（缓存键格式为 skeleton-atlas-scale，scale 默认为 1）
    PIXI.Cache.remove(`${skeletonAlias}-${atlasAlias}-1`)
    // 清理 SpineTexture 静态缓存中已随图集释放的贴图
    const textureMap = (
      SpineTexture as unknown as {
        textureMap: Map<PIXI.TextureSource, SpineTexture>
      }
    ).textureMap
    for (const [textureSource, spineTexture] of textureMap) {
      if (spineTexture.texture.destroyed) {
        textureMap.delete(textureSource)
      }
    }
    skeletonAlias = null
    atlasAlias = null
    pageTextureUrls = []
  }
})
</script>

<template>
  <div ref="l2dContainer" class="live2d-container"></div>
</template>

<style scoped>
.live2d-container {
  width: max-content;
  height: 100dvh;
  position: absolute;
  justify-content: center;
  display: flex;
  overflow: hidden;
  z-index: -1;
  bottom: 0;
}

.live2d-container :deep(canvas) {
  display: block;
}
</style>
