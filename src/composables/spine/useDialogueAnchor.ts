import { ref, watch, computed, nextTick, onUnmounted, type Ref } from 'vue'
import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { Application } from 'pixi.js'
import type { MemorialLobby } from '@/types/config'
import { findDialogueAnchorBone } from './boneDetect'
import { boneToClientPoint } from './boneToClient'
import {
  type DialogueMode,
  type DialogueSide,
  resolveAutoSide,
  resolveConfiguredSide,
  resolveDialogueMode,
  resolveDialogueOffsets,
  resolveManualTranslate,
  fallbackAnchorClientPoint
} from './dialogueDisplayUtils'

const SMOOTH_FACTOR = 0.18
const BUBBLE_GAP_PX = 12
/** 气泡与视口边缘的最小间距（与原 CSS `100vw - 24px` 的两侧留白一致） */
const VIEWPORT_MARGIN_PX = 12
/** 气泡宽度上限占视口宽的比例（与原 CSS `40vw` 一致） */
const MAX_WIDTH_VW_RATIO = 0.4

interface UseDialogueAnchorOptions {
  showDialogue: Ref<boolean>
  getSpine: () => Spine | null
  getCanvas: () => HTMLCanvasElement | null | undefined
  getApp: () => Application | null | undefined
  getLobby: () => MemorialLobby | undefined
  /** 气泡层元素（量高做垂直收边用）；可选，缺省时跳过垂直收边 */
  getLayerEl?: () => HTMLElement | null
}

export function useDialogueAnchor(options: UseDialogueAnchorOptions) {
  const mode = ref<DialogueMode>('auto')
  const side = ref<DialogueSide>('right')
  // 视口收边后的落点与可用宽度，layerStyle 直接消费
  const posX = ref(0)
  const posY = ref(0)
  /** 收边后的可用宽度（px）；负值 = 尚未收边，不输出 CSS 变量 */
  const maxWidthPx = ref(-1)

  let rafId: number | null = null
  let smoothX = 0
  let smoothY = 0
  let targetX = 0
  let targetY = 0

  const stopLoop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  /**
   * 视口收边：锚点贴边/出屏时，水平方向压缩气泡可用宽度（触发文字换行），
   * 垂直方向按气泡实际高度平移，保证气泡完整留在屏幕内
   * @param rawX 未收边的锚点 x（side=right 加 gap 后为气泡左缘，left 减 gap 为右缘）
   * @param rawY 未收边的锚点 y（气泡垂直中心）
   * @param gap 气泡与锚点的间距（auto 跟嘴用 BUBBLE_GAP_PX，manual 无间距）
   */
  const clampToViewport = (rawX: number, rawY: number, gap: number) => {
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight

    // 水平：先把靠锚点一侧的边缘收进视口，再按剩余空间压缩最大宽度
    const nearEdge = side.value === 'right' ? rawX + gap : rawX - gap
    const x = Math.min(Math.max(nearEdge, VIEWPORT_MARGIN_PX), vw - VIEWPORT_MARGIN_PX)
    const avail = side.value === 'right' ? vw - VIEWPORT_MARGIN_PX - x : x - VIEWPORT_MARGIN_PX
    const widthCap = Math.min(vw - VIEWPORT_MARGIN_PX * 2, vw * MAX_WIDTH_VW_RATIO)
    maxWidthPx.value = Math.max(0, Math.floor(Math.min(widthCap, avail)))

    // 垂直：translateY(-50%) 居中前提下，按实测气泡高度把中心点收进可视范围
    let y: number
    const height = options.getLayerEl?.()?.offsetHeight ?? 0
    if (height > 0) {
      if (height >= vh - VIEWPORT_MARGIN_PX * 2) {
        // 气泡比视口还高（极端长文本）：居中兜底
        y = vh / 2
      } else {
        const half = height / 2
        y = Math.min(Math.max(rawY, VIEWPORT_MARGIN_PX + half), vh - VIEWPORT_MARGIN_PX - half)
      }
    } else {
      y = Math.min(Math.max(rawY, VIEWPORT_MARGIN_PX), vh - VIEWPORT_MARGIN_PX)
    }

    posX.value = x
    posY.value = y
  }

  const applyManualLayout = () => {
    const display = options.getLobby()?.dialogueDisplay
    const translate = resolveManualTranslate(display)
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const configured = resolveConfiguredSide(display)
    side.value = configured === 'auto' ? 'right' : configured
    clampToViewport(vw / 2 + translate.x, vh / 2 + translate.y, 0)
  }

  const sampleAutoAnchor = (): { x: number; y: number } | null => {
    const spine = options.getSpine()
    const canvas = options.getCanvas()
    const app = options.getApp()
    const lobby = options.getLobby()
    if (!canvas) return null

    if (!spine || !app) {
      return fallbackAnchorClientPoint(canvas, lobby)
    }

    const bone = findDialogueAnchorBone(spine.skeleton, lobby?.dialogueDisplay?.bone)
    if (bone) {
      const point = boneToClientPoint(spine, canvas, app, bone.data.name)
      if (point) {
        const { x: ox, y: oy } = resolveDialogueOffsets(lobby?.dialogueDisplay)
        return { x: point.x + ox, y: point.y + oy }
      }
    }

    return fallbackAnchorClientPoint(canvas, lobby)
  }

  const tick = () => {
    if (!options.showDialogue.value) {
      stopLoop()
      return
    }

    const lobby = options.getLobby()
    const display = lobby?.dialogueDisplay
    mode.value = resolveDialogueMode(display)

    if (mode.value === 'manual') {
      applyManualLayout()
      stopLoop()
      return
    }

    const sample = sampleAutoAnchor()
    if (sample) {
      targetX = sample.x
      targetY = sample.y
      if (!rafId) {
        smoothX = targetX
        smoothY = targetY
      } else {
        smoothX += (targetX - smoothX) * SMOOTH_FACTOR
        smoothY += (targetY - smoothY) * SMOOTH_FACTOR
      }

      const configured = resolveConfiguredSide(display)
      side.value = configured === 'auto' ? resolveAutoSide(smoothX, lobby) : configured
      clampToViewport(smoothX, smoothY, BUBBLE_GAP_PX)
    }

    rafId = requestAnimationFrame(tick)
  }

  const startLoop = () => {
    stopLoop()
    mode.value = resolveDialogueMode(options.getLobby()?.dialogueDisplay)

    if (mode.value === 'manual') {
      applyManualLayout()
      return
    }

    const sample = sampleAutoAnchor()
    if (sample) {
      smoothX = sample.x
      smoothY = sample.y
      targetX = sample.x
      targetY = sample.y
      const configured = resolveConfiguredSide(options.getLobby()?.dialogueDisplay)
      side.value =
        configured === 'auto' ? resolveAutoSide(sample.x, options.getLobby()) : configured
      clampToViewport(sample.x, sample.y, BUBBLE_GAP_PX)
    }

    rafId = requestAnimationFrame(tick)
  }

  watch(options.showDialogue, async (visible) => {
    if (!visible) {
      stopLoop()
      return
    }
    startLoop()
    // manual 没有逐帧循环，等 DOM 更新拿到气泡真实尺寸后再收边一次
    await nextTick()
    if (options.showDialogue.value && mode.value === 'manual') applyManualLayout()
  })

  const onResize = () => {
    if (!options.showDialogue.value) return
    if (mode.value === 'manual') applyManualLayout()
    else startLoop()
  }

  watch(
    () => options.getLobby()?.dialogueDisplay,
    () => {
      if (options.showDialogue.value) startLoop()
    }
  )

  onUnmounted(stopLoop)

  const layerStyle = computed((): Record<string, string> => {
    const style: Record<string, string> = {
      left: `${posX.value}px`,
      top: `${posY.value}px`,
      transform: side.value === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)'
    }
    // 气泡是 width: max-content，不吃气泡层 max-width——可用宽度经 CSS 变量
    // 传给 .dialogue 自身的 max-width 才能真正压缩；首帧收边前不输出，走 CSS 兜底
    if (maxWidthPx.value >= 0) {
      style['--dialogue-max-w'] = `${maxWidthPx.value}px`
    }
    return style
  })

  return {
    mode,
    side,
    layerStyle,
    onResize
  }
}
