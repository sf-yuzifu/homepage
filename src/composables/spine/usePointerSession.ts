import { onMounted, onUnmounted } from 'vue'
import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { Application } from 'pixi.js'
import { hitTestBones, hitTestHeadRegion } from './boneDetect'
import type { DragTarget, SpineInteractionContext } from './types'

const BONE_HIT_RADIUS = 100
const BONE_HIT_FALLBACK_RADIUS = 160
const DRAG_START_THRESHOLD = 12
const LONG_PRESS_THRESHOLD = 500

interface PressSession {
  sx: number
  sy: number
  world: { x: number; y: number }
  moved: boolean
  longPressed: boolean
  kind: 'pat' | 'drag' | 'gaze' | null
  dragTarget: DragTarget | null
  longPressTimer: number | null
}

export interface PointerPatApi {
  canStart: () => boolean
  start: (x: number, y: number) => boolean
  move: (x: number, y: number) => void
  end: () => void
  isEngaged: () => boolean
  isActive: () => boolean
}

export interface PointerGazeApi {
  start: (x: number, y: number) => boolean
  move: (x: number, y: number) => void
  end: () => void
}

export interface PointerBoneDragApi {
  probe: (x: number, y: number) => DragTarget | null
  start: (target: DragTarget, x: number, y: number) => boolean
  move: (x: number, y: number) => void
  end: () => void
}

export interface PointerTalkApi {
  playTalk: () => void
}

export interface PointerSessionDeps {
  getSpine: () => Spine | null
  getCanvas: () => HTMLCanvasElement | null
  getApp: () => Application | null
  isReady: () => boolean
  ctx: SpineInteractionContext
  pat: PointerPatApi
  gaze: PointerGazeApi
  boneDrag: PointerBoneDragApi
  talkPlayer: PointerTalkApi
}

/**
 * 指针会话状态机（与原游戏交互逻辑一致）：
 *   快速点按身体 = 对话（Talk）
 *   按住拖动 = 命中特殊骨骼则捏脸拖拽，否则视线跟随（EyeIK）
 *   静止长按头部 = 摸头（HairPatIK），摸头中移动 = 头部跟随手指
 */
export function usePointerSession(deps: PointerSessionDeps) {
  const { getSpine, getCanvas, getApp, isReady, ctx, pat, gaze, boneDrag, talkPlayer } = deps

  let pressSession: PressSession | null = null
  let hoverRafId: number | null = null
  let lastHoverEvent: MouseEvent | null = null
  let cachedViewRect: DOMRect | null = null
  let isL2dHovering = false

  const clientToWorld = (clientX: number, clientY: number, rect: DOMRect) => {
    const animation = getSpine()
    const l2d = getApp()
    if (!animation || !l2d) return { x: 0, y: 0 }
    const scaleX = rect.width / l2d.screen.width
    const scaleY = rect.height / l2d.screen.height
    return {
      x: ((clientX - rect.left) / scaleX - animation.x) / animation.scale.x,
      y: ((clientY - rect.top) / scaleY - animation.y) / animation.scale.y
    }
  }

  const onPressDown = (event: MouseEvent) => {
    const animation = getSpine()
    const canvas = getCanvas()
    if (!animation || !canvas || !isReady() || !ctx.isIdleMode()) return
    const world = clientToWorld(event.clientX, event.clientY, canvas.getBoundingClientRect())
    const session: PressSession = {
      sx: event.clientX,
      sy: event.clientY,
      world,
      moved: false,
      longPressed: false,
      kind: null,
      dragTarget: boneDrag.probe(world.x, world.y),
      longPressTimer: null
    }
    session.longPressTimer = window.setTimeout(() => {
      if (pressSession !== session || session.moved) return
      session.longPressed = true
      if (
        pat.canStart() &&
        animation.skeleton &&
        hitTestHeadRegion(animation.skeleton, world.x, world.y, BONE_HIT_RADIUS)
      ) {
        session.kind = 'pat'
        pat.start(world.x, world.y)
      }
    }, LONG_PRESS_THRESHOLD)
    pressSession = session
    window.addEventListener('mousemove', onPressMove)
    window.addEventListener('mouseup', onPressUp)
  }

  const onPressMove = (event: MouseEvent) => {
    const session = pressSession
    const animation = getSpine()
    if (!session || !animation) return
    const hoverCanvas = getCanvas()
    if (!hoverCanvas) return
    if (!cachedViewRect) cachedViewRect = hoverCanvas.getBoundingClientRect()
    const world = clientToWorld(event.clientX, event.clientY, cachedViewRect)

    if (session.kind === 'pat') {
      pat.move(world.x, world.y)
      return
    }

    if (!session.moved) {
      const dist = Math.hypot(event.clientX - session.sx, event.clientY - session.sy)
      if (dist < DRAG_START_THRESHOLD) return
      session.moved = true
      if (session.longPressTimer !== null) clearTimeout(session.longPressTimer)
      if (
        session.dragTarget &&
        boneDrag.start(session.dragTarget, session.world.x, session.world.y)
      ) {
        session.kind = 'drag'
      } else if (gaze.start(session.world.x, session.world.y)) {
        session.kind = 'gaze'
      } else {
        return
      }
    }

    if (session.kind === 'drag') boneDrag.move(world.x, world.y)
    else if (session.kind === 'gaze') gaze.move(world.x, world.y)
  }

  const handleTap = (event: MouseEvent) => {
    const animation = getSpine()
    if (
      !animation ||
      !animation.state ||
      !isReady() ||
      ctx.flags.talking.value ||
      !ctx.isIdleMode()
    ) {
      return
    }
    if (pat.isEngaged() && pat.isActive()) return

    const tapCanvas = getCanvas()
    if (!tapCanvas) return
    const world = clientToWorld(event.clientX, event.clientY, tapCanvas.getBoundingClientRect())
    if (hitTestBones(animation.skeleton, world.x, world.y, BONE_HIT_RADIUS).length > 0) {
      talkPlayer.playTalk()
      return
    }
    if (hitTestBones(animation.skeleton, world.x, world.y, BONE_HIT_FALLBACK_RADIUS).length > 0) {
      talkPlayer.playTalk()
    }
  }

  const onPressUp = (event: MouseEvent) => {
    const session = pressSession
    if (!session) return
    pressSession = null
    if (session.longPressTimer !== null) clearTimeout(session.longPressTimer)
    window.removeEventListener('mousemove', onPressMove)
    window.removeEventListener('mouseup', onPressUp)

    if (session.kind === 'pat') {
      pat.end()
      return
    }
    if (session.kind === 'drag') {
      boneDrag.end()
      return
    }
    if (session.kind === 'gaze') {
      gaze.end()
      return
    }
    if (session.longPressed) return
    if (event) handleTap(event)
  }

  const cancelPressSession = () => {
    if (!pressSession) return
    const kind = pressSession.kind
    if (pressSession.longPressTimer !== null) clearTimeout(pressSession.longPressTimer)
    pressSession = null
    window.removeEventListener('mousemove', onPressMove)
    window.removeEventListener('mouseup', onPressUp)
    if (kind === 'pat') pat.end()
    else if (kind === 'drag') boneDrag.end()
    else if (kind === 'gaze') gaze.end()
  }

  const processBoneHover = (event: MouseEvent) => {
    const animation = getSpine()
    const canvas = getCanvas()
    if (!animation || !animation.skeleton || !canvas || !isReady()) {
      return
    }

    if (!cachedViewRect) {
      cachedViewRect = canvas.getBoundingClientRect()
    }

    const { x: worldX, y: worldY } = clientToWorld(event.clientX, event.clientY, cachedViewRect)
    const isHovering = hitTestBones(animation.skeleton, worldX, worldY, BONE_HIT_RADIUS).length > 0

    if (isHovering !== isL2dHovering) {
      isL2dHovering = isHovering
      if (isHovering) {
        canvas.classList.add('l2d-hover')
      } else {
        canvas.classList.remove('l2d-hover')
      }
    }
  }

  const handleBoneHover = (event: MouseEvent) => {
    lastHoverEvent = event
    if (hoverRafId !== null) return
    hoverRafId = requestAnimationFrame(() => {
      hoverRafId = null
      if (lastHoverEvent) {
        processBoneHover(lastHoverEvent)
      }
    })
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!pressSession) handleBoneHover(event)
  }

  const handleMouseLeave = () => {
    isL2dHovering = false
    getCanvas()?.classList.remove('l2d-hover')
  }

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length > 0) {
      const touchEvent = event.touches[0]
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touchEvent.clientX,
        clientY: touchEvent.clientY
      })
      onPressDown(mouseEvent)
    }
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (pressSession && event.touches.length > 0) {
      const touchEvent = event.touches[0]
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touchEvent.clientX,
        clientY: touchEvent.clientY
      })
      onPressMove(mouseEvent)
    }
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (event.changedTouches.length > 0) {
      const touchEvent = event.changedTouches[0]
      const mouseEvent = new MouseEvent('mouseup', {
        clientX: touchEvent.clientX,
        clientY: touchEvent.clientY
      })
      onPressUp(mouseEvent)
    }
  }

  const addEventListenersToCanvas = () => {
    const canvas = getCanvas()
    if (!canvas) return
    removeEventListenersFromCanvas()
    canvas.addEventListener('mousedown', onPressDown)
    canvas.addEventListener('mouseup', onPressUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true })
    canvas.addEventListener('touchend', handleTouchEnd)
    canvas.addEventListener('touchcancel', handleTouchEnd)
  }

  const removeEventListenersFromCanvas = () => {
    const canvas = getCanvas()
    if (!canvas) return
    canvas.removeEventListener('mousedown', onPressDown)
    canvas.removeEventListener('mouseup', onPressUp)
    canvas.removeEventListener('mouseleave', handleMouseLeave)
    canvas.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('touchstart', handleTouchStart)
    canvas.removeEventListener('touchmove', handleTouchMove)
    canvas.removeEventListener('touchend', handleTouchEnd)
    canvas.removeEventListener('touchcancel', handleTouchEnd)
  }

  const invalidateViewRect = () => {
    cachedViewRect = null
  }

  const cancelHoverRaf = () => {
    if (hoverRafId !== null) {
      cancelAnimationFrame(hoverRafId)
      hoverRafId = null
    }
  }

  onMounted(() => {
    window.addEventListener('blur', cancelPressSession)
  })

  onUnmounted(() => {
    cancelHoverRaf()
    cancelPressSession()
    removeEventListenersFromCanvas()
    window.removeEventListener('blur', cancelPressSession)
  })

  return {
    clientToWorld,
    addEventListenersToCanvas,
    removeEventListenersFromCanvas,
    cancelPressSession,
    invalidateViewRect,
    cancelHoverRaf
  }
}
