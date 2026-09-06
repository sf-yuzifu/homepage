import { ref, watch, computed, onUnmounted, type Ref } from 'vue'
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

interface UseDialogueAnchorOptions {
  showDialogue: Ref<boolean>
  getSpine: () => Spine | null
  getCanvas: () => HTMLCanvasElement | null | undefined
  getApp: () => Application | null | undefined
  getLobby: () => MemorialLobby | undefined
}

export function useDialogueAnchor(options: UseDialogueAnchorOptions) {
  const mode = ref<DialogueMode>('auto')
  const side = ref<DialogueSide>('right')
  const anchorX = ref(0)
  const anchorY = ref(0)
  const manualX = ref(0)
  const manualY = ref(0)

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

  const applyManualLayout = () => {
    const display = options.getLobby()?.dialogueDisplay
    const translate = resolveManualTranslate(display)
    manualX.value = translate.x
    manualY.value = translate.y
    const configured = resolveConfiguredSide(display)
    side.value = configured === 'auto' ? 'right' : configured
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
      anchorX.value = smoothX
      anchorY.value = smoothY

      const configured = resolveConfiguredSide(display)
      side.value = configured === 'auto' ? resolveAutoSide(smoothX, lobby) : configured
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
      anchorX.value = sample.x
      anchorY.value = sample.y
      const configured = resolveConfiguredSide(options.getLobby()?.dialogueDisplay)
      side.value =
        configured === 'auto' ? resolveAutoSide(sample.x, options.getLobby()) : configured
    }

    rafId = requestAnimationFrame(tick)
  }

  watch(options.showDialogue, (visible) => {
    if (visible) startLoop()
    else stopLoop()
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
    if (mode.value === 'manual') {
      const base = `calc(50% + ${manualX.value}px)`
      const y = `calc(50% + ${manualY.value}px)`
      if (side.value === 'left') {
        return {
          left: base,
          top: y,
          transform: 'translate(-100%, -50%)'
        }
      }
      return {
        left: base,
        top: y,
        transform: 'translateY(-50%)'
      }
    }

    const gap = `${BUBBLE_GAP_PX}px`
    if (side.value === 'right') {
      return {
        left: `calc(${anchorX.value}px + ${gap})`,
        top: `${anchorY.value}px`,
        transform: 'translateY(-50%)'
      }
    }
    return {
      left: `calc(${anchorX.value}px - ${gap})`,
      top: `${anchorY.value}px`,
      transform: 'translate(-100%, -50%)'
    }
  })

  return {
    mode,
    side,
    layerStyle,
    onResize
  }
}
