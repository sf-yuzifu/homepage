import {
  watch,
  ref,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  type ComputedRef,
  type Ref
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import type { AnimationState, AnimationStateListener } from '@esotericsoftware/spine-core'
import * as PIXI from 'pixi.js'
import { Modal } from '@arco-design/web-vue'
import type { ModalReturn } from '@arco-design/web-vue'
import { prefersReducedMotionNow } from '@/composables/useReducedMotion'
import { consumeLocaleChangePending } from '@/composables/useConfig'
import { useSettings } from '@/composables/useSettings'
import type { AppConfig } from '@/types/config'
import { retryAsync } from '@/utils/retry'
import { tryCreatePixiApp } from './createPixiApp'
import { initTracks } from './useSpineTracks'

export type L2DTarget = number | '+' | '-'

const LIVE2D_TIME_SCALE = 1

const parseOffset = (offset: number | string | undefined, fallback = 0.7): number => {
  const parsed = Number(offset)
  return Number.isNaN(parsed) ? fallback : parsed
}

const getLobbyAssetKey = (
  lobby: { path?: string; skel?: string; atlas?: string } | undefined
): string | null => {
  if (!lobby?.path || !lobby.skel || !lobby.atlas) return null
  return lobby.path + lobby.skel + '|' + lobby.path + lobby.atlas
}

export interface SpineLifecyclePointerHooks {
  cancelPressSession: () => void
  invalidateViewRect: () => void
  addEventListenersToCanvas: () => void
  removeEventListenersFromCanvas: () => void
  cancelHoverRaf: () => void
}

interface InteractModule {
  attach: (spine: Spine) => void
  detach: () => void
  update: (dt: number) => void
}

interface SpineLifecycleDeps {
  emit: {
    (e: 'canskip', value: boolean): void
    (e: 'update:changeL2D', value: boolean): void
    (e: 'webgl-failed'): void
  }
  currentConfig: ComputedRef<AppConfig | null>
  canSkip: Ref<boolean>
  showDialogue: Ref<boolean>
  talkPlayer: {
    reset: () => void
    stopAllVoices: () => void
    clearVoiceAndDialogue: () => void
    attachEventListener: (state: AnimationState) => void
  }
  gaze: InteractModule
  pat: InteractModule
  boneDrag: InteractModule
  randomClips: { start: () => void; stop: () => void }
  pointer: SpineLifecyclePointerHooks
}

export function useSpineLifecycle(deps: SpineLifecycleDeps) {
  const {
    emit,
    currentConfig,
    canSkip,
    showDialogue,
    talkPlayer,
    gaze,
    pat,
    boneDrag,
    randomClips,
    pointer
  } = deps

  let animation: Spine | null = null
  let id = 0
  let animationReady = false
  let modalRef: ModalReturn | null = null
  let originalOffsetPercent = 70
  let loadedL2DKey: string | null = null
  let canvasRetryTimer: number | null = null
  let isComponentUnmounted = false
  let setL2DInFlight: Promise<void> | null = null
  let isFirstLoad = true
  // 首帧加载才受「开场演出」偏好约束；手动切换角色始终播放各自的入场
  let introDecided = false

  const { shouldPlayIntro, markIntroSeen } = useSettings()

  const webglFailed = ref(false)
  const revealHud = (failed = false) => {
    canSkip.value = false
    emit('canskip', false)
    emit('update:changeL2D', false)
    if (failed) emit('webgl-failed')
  }

  // PIXI 8：应用只能异步创建（构造器不再接受参数）。appReady 收敛创建时序，
  // 所有依赖 app/canvas/stage 的操作（挂载 canvas、加载角色、生命周期钩子）都经它就绪后再执行；
  // 创建失败时置 webglFailed，由 onMounted 里的 appReady 分支降级 revealHud（静态背景）
  let l2d: PIXI.Application | null = null
  let canvas: HTMLCanvasElement | null = null
  let spineLayer: PIXI.Container | null = null
  // 组件是否处于 keep-alive 激活窗口（onActivated/onDeactivated 维护）：
  // 防止 appReady 在组件停用后才 resolve，错误地把 ticker 重新拉起
  let viewActive = false

  const appReady: Promise<PIXI.Application | null> = tryCreatePixiApp({
    width: 2560,
    height: 1440,
    backgroundAlpha: 0,
    // Spine 边缘由图集 alpha 平滑（MSAA 只作用于几何边缘，此处收益极小），
    // 关闭 MSAA 并把渲染倍率压到 1.5，显著降低低端 GPU 的每帧光栅开销
    antialias: false,
    resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5),
    powerPreference: 'high-performance'
  }).then((app) => {
    if (!app) {
      webglFailed.value = true
      return null
    }
    l2d = app
    canvas = app.canvas as HTMLCanvasElement
    spineLayer = app.stage
    return app
  })

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    if (webglFailed.value) return
    webglFailed.value = true
    l2d?.ticker.stop()
    talkPlayer.stopAllVoices()
    pointer.removeEventListenersFromCanvas()
    canvas?.removeEventListener('webglcontextlost', handleContextLost)
    if (canvas?.parentNode) canvas.parentNode.removeChild(canvas)
    revealHud(true)
  }

  const changeL2D = (value: boolean) => {
    emit('update:changeL2D', value)
  }

  const handleWindowResize = () => {
    pointer.invalidateViewRect()
  }

  const handleBeforeUpdateWorldTransforms = () => {
    const dt = PIXI.Ticker.shared.deltaMS / 1000
    gaze.update(dt)
    pat.update(dt)
    boneDrag.update(dt)
  }

  const attachInteractions = (spine: Spine) => {
    spine.beforeUpdateWorldTransforms = handleBeforeUpdateWorldTransforms
    gaze.attach(spine)
    pat.attach(spine)
    boneDrag.attach(spine)
    if (!prefersReducedMotionNow()) {
      randomClips.start()
    }
  }

  const detachInteractions = () => {
    gaze.detach()
    pat.detach()
    boneDrag.detach()
    randomClips.stop()
  }

  const addCanvasToBackground = () => {
    if (isComponentUnmounted || !canvas) return

    try {
      const backgroundElement = document.querySelector('#background')
      if (backgroundElement) {
        if (!canvas.parentNode || canvas.parentNode !== backgroundElement) {
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas)
          }
          backgroundElement.appendChild(canvas)
          canvas.id = 'l2d-canvas'
          canvas.style.position = 'relative'
          canvas.style.pointerEvents = 'auto'
          canvas.style.zIndex = '1'
        }
      } else {
        canvasRetryTimer = window.setTimeout(addCanvasToBackground, 100)
      }
    } catch {
      canvasRetryTimer = window.setTimeout(addCanvasToBackground, 100)
    }
  }

  const addAssetAlias = (alias: string, src: string) => {
    if (!PIXI.Assets.resolver.hasKey(alias)) {
      PIXI.Assets.add({ alias, src })
    }
  }

  const applyCanvasOffset = (lobby: NonNullable<AppConfig['memorialLobbies']>[number]) => {
    if (!canvas) return
    originalOffsetPercent = parseOffset(lobby.offset) * 100
    canvas.style.transform = `translateX(calc((50% - ${originalOffsetPercent} * 1%) * (1 - min(1, 100vw / 1200px))))`
    pointer.invalidateViewRect()
  }

  const finishSpineSetup = (spine: Spine, skeletonPath: string, atlasPath: string) => {
    initTracks(spine)
    spineLayer?.addChild(spine)
    loadedL2DKey = skeletonPath + '|' + atlasPath
    spine.scale.set(0.85)
    spine.state.setAnimation(0, 'Idle_01', true)
    spine.state.timeScale = LIVE2D_TIME_SCALE
    spine.autoUpdate = true
    spine.y = 1440
    spine.x = 2560 / 2
    attachInteractions(spine)
  }

  const doSetL2D = async (num: L2DTarget): Promise<void> => {
    if (webglFailed.value) return
    if (!(await appReady)) return
    addCanvasToBackground()

    if (!currentConfig.value?.memorialLobbies) {
      return
    }

    const lobbies = currentConfig.value.memorialLobbies

    let newId: number
    switch (num) {
      case '-':
        newId = id === 0 ? lobbies.length - 1 : id - 1
        break
      case '+':
        newId = id === lobbies.length - 1 ? 0 : id + 1
        break
      default:
        newId = num
    }

    if (newId < 0 || newId >= lobbies.length) {
      return
    }

    const lobby = lobbies[newId]
    if (!lobby.path || !lobby.skel || !lobby.atlas) {
      return
    }

    const assetKey = getLobbyAssetKey(lobby)
    if (animation && assetKey && assetKey === loadedL2DKey && newId === id) {
      consumeLocaleChangePending()
      return
    }

    id = newId
    canSkip.value = true
    emit('canskip', true)
    talkPlayer.reset()
    pointer.cancelPressSession()
    talkPlayer.stopAllVoices()

    if (animation) {
      detachInteractions()
      spineLayer?.removeChild(animation)
      animation.destroy()
      animation = null
    }

    try {
      const skeletonPath = lobby.path + lobby.skel
      const atlasPath = lobby.path + lobby.atlas
      const skeletonAlias = `skeleton_${id}`
      const atlasAlias = `atlas_${id}`

      addAssetAlias(skeletonAlias, skeletonPath)
      addAssetAlias(atlasAlias, atlasPath)
      // 失败自动重试 3 次（预加载阶段已失败的角色，切换/进场时再试一次）
      await retryAsync(() => PIXI.Assets.load([skeletonAlias, atlasAlias]))

      animation = Spine.from({ skeleton: skeletonAlias, atlas: atlasAlias })
      if (!animation) return
      finishSpineSetup(animation, skeletonPath, atlasPath)
    } catch (error) {
      // 重试后仍失败：保持大厅其他部分可用（降级），不再静默吞掉错误
      console.error(`Live2D角色资源重试后仍加载失败，跳过该角色: ${lobby.path}`, error)
      return
    }

    applyCanvasOffset(lobby)
    showDialogue.value = false
    let startIdle = 'Start_Idle_01'
    if (!animation.state.data.skeletonData.findAnimation('Start_Idle_01'))
      startIdle = 'Start_idle_01'
    talkPlayer.attachEventListener(animation.state)
    const skipIntroForLocale = consumeLocaleChangePending()
    const isInitialLoad = !introDecided
    introDecided = true
    const playStartIdle =
      !skipIntroForLocale &&
      !prefersReducedMotionNow() &&
      animation.state.data.skeletonData.findAnimation(startIdle) &&
      (!isInitialLoad || shouldPlayIntro())
    if (playStartIdle) {
      if (isInitialLoad) markIntroSeen()
      changeL2D(true)
      animation.state.setAnimation(0, startIdle, false)
      const currentTrack = animation.state.getCurrent(0)
      if (
        currentTrack &&
        currentTrack.animation &&
        currentTrack.animation.name !== 'Idle_01' &&
        animation.state.data.skeletonData.findAnimation('Idle_01')
      ) {
        animation.state.addAnimation(0, 'Idle_01', true)
      }
      const targetAnimation = animation
      const listener: AnimationStateListener = {
        complete: (entry) => {
          if (entry.trackIndex === 0 && entry.animation?.name !== 'Idle_01') {
            changeL2D(false)
            targetAnimation.state.listeners = []
            talkPlayer.attachEventListener(targetAnimation.state)
            canSkip.value = false
            emit('canskip', false)
            modalRef?.close()
          }
        }
      }
      animation.state.addListener(listener)
    } else {
      changeL2D(false)
      canSkip.value = false
      emit('canskip', false)
      modalRef?.close()
      if (animation?.state) {
        const currentTrack = animation.state.getCurrent(0)
        if (
          currentTrack?.animation?.name !== 'Idle_01' &&
          animation.state.data.skeletonData.findAnimation('Idle_01')
        ) {
          animation.state.setAnimation(0, 'Idle_01', true)
        }
        animation.state.listeners = []
        talkPlayer.attachEventListener(animation.state)
      }
    }

    animationReady = true
    pointer.addEventListenersToCanvas()
  }

  const setL2D = (num: L2DTarget): Promise<void> => {
    if (setL2DInFlight) return setL2DInFlight
    setL2DInFlight = doSetL2D(num).finally(() => {
      setL2DInFlight = null
    })
    return setL2DInFlight
  }

  const loadL2DSkipIdle = async (num: number): Promise<void> => {
    if (webglFailed.value) return
    if (!(await appReady)) return
    addCanvasToBackground()

    if (!currentConfig.value?.memorialLobbies) {
      return
    }

    canSkip.value = false
    emit('canskip', false)
    talkPlayer.reset()
    pointer.cancelPressSession()
    talkPlayer.stopAllVoices()

    const lobbies = currentConfig.value.memorialLobbies
    if (num < 0 || num >= lobbies.length) {
      return
    }

    const lobby = lobbies[num]
    if (!lobby.path || !lobby.skel || !lobby.atlas) {
      return
    }

    try {
      const skeletonPath = lobby.path + lobby.skel
      const atlasPath = lobby.path + lobby.atlas
      const skeletonAlias = `skeleton_${num}`
      const atlasAlias = `atlas_${num}`

      addAssetAlias(skeletonAlias, skeletonPath)
      addAssetAlias(atlasAlias, atlasPath)
      // 失败自动重试 3 次（预加载阶段已失败的角色，返回大厅时再试一次）
      await retryAsync(() => PIXI.Assets.load([skeletonAlias, atlasAlias]))

      animation = Spine.from({ skeleton: skeletonAlias, atlas: atlasAlias })
      if (!animation) return
      finishSpineSetup(animation, skeletonPath, atlasPath)
    } catch (error) {
      // 重试后仍失败：保持大厅其他部分可用（降级），不再静默吞掉错误
      console.error(`Live2D角色资源重试后仍加载失败，跳过该角色: ${lobby.path}`, error)
      return
    }

    applyCanvasOffset(lobby)
    showDialogue.value = false
    talkPlayer.attachEventListener(animation.state)
    animationReady = true
    pointer.addEventListenersToCanvas()
  }

  const stopAllVoiceAndCleanup = () => {
    talkPlayer.clearVoiceAndDialogue()
    if (modalRef) {
      modalRef.close()
      modalRef = null
    }
    pointer.cancelPressSession()
    detachInteractions()
    if (animation) {
      if (animation.state) {
        animation.state.listeners = []
      }
      spineLayer?.removeChild(animation)
      animation.destroy()
      animation = null
    }
    talkPlayer.reset()
    animationReady = false
  }

  const skipStartIdle = () => {
    if (modalRef) return

    if (!animation || !animation.state || !animationReady) {
      changeL2D(false)
      return
    }

    try {
      const currentTrack = animation.state.getCurrent(0)
      if (!currentTrack || !currentTrack.animation) {
        changeL2D(false)
        return
      }

      if (
        currentTrack.animation.name !== 'Idle_01' &&
        animation.state.data.skeletonData.findAnimation('Idle_01')
      ) {
        if (!currentConfig.value?.translate) {
          changeL2D(false)
          return
        }

        modalRef = Modal.open({
          title: currentConfig.value.translate.info,
          content: currentConfig.value.translate.ifSkip || '',
          okText: currentConfig.value.translate.ok,
          cancelText: currentConfig.value.translate.cancel,
          onOk: () => {
            changeL2D(false)
            talkPlayer.stopAllVoices()

            if (animation && animation.state) {
              animation.state.setAnimation(0, 'Idle_01', true)
              initTracks(animation)
              animation.state.listeners = []
              talkPlayer.attachEventListener(animation.state)
            }

            canSkip.value = false
            emit('canskip', false)
          },
          onClose: () => {
            modalRef = null
          }
        })
      }
    } catch {
      changeL2D(false)
    }
  }

  const initLive2DWhenReady = () => {
    if (!currentConfig.value?.memorialLobbies) {
      return
    }

    const lobby = currentConfig.value.memorialLobbies[id]
    const key = getLobbyAssetKey(lobby)
    if (animation && key && key === loadedL2DKey) {
      consumeLocaleChangePending()
      return
    }

    setL2D(id)
  }

  onMounted(() => {
    window.addEventListener('resize', handleWindowResize)
    void appReady.then((app) => {
      if (!app) {
        revealHud(true)
        return
      }
      if (isComponentUnmounted || !canvas) return
      addCanvasToBackground()
      canvas.addEventListener('webglcontextlost', handleContextLost)
    })
  })

  onBeforeRouteLeave(() => {
    stopAllVoiceAndCleanup()
  })

  onActivated(() => {
    viewActive = true
    void appReady.then((app) => {
      if (!app) {
        revealHud(true)
        return
      }
      // appReady resolve 前组件可能已停用/卸载——不要把 ticker 重新拉起
      if (!viewActive || isComponentUnmounted) return
      app.ticker.start()
      addCanvasToBackground()
      if (!animation && currentConfig.value?.memorialLobbies) {
        if (isFirstLoad) {
          setL2D(id)
          isFirstLoad = false
        } else {
          loadL2DSkipIdle(id)
        }
      }
      talkPlayer.reset()
    })
  })

  onDeactivated(() => {
    viewActive = false
    if (!webglFailed.value) l2d?.ticker.stop()
  })

  onUnmounted(() => {
    isComponentUnmounted = true
    if (canvasRetryTimer) {
      clearTimeout(canvasRetryTimer)
      canvasRetryTimer = null
    }
    pointer.cancelHoverRaf()
    pointer.cancelPressSession()
    detachInteractions()
    pointer.removeEventListenersFromCanvas()
    window.removeEventListener('resize', handleWindowResize)
    canvas?.removeEventListener('webglcontextlost', handleContextLost)
    try {
      l2d?.destroy(true)
    } catch {
      /* 上下文已丢失时 destroy 可能再抛 */
    }
  })

  watch(
    currentConfig,
    (newConfig) => {
      if (newConfig?.memorialLobbies && newConfig.memorialLobbies.length > 0) {
        initLive2DWhenReady()
      }
    },
    { immediate: true }
  )

  return {
    // PIXI 8 异步入驻：以 getter 暴露，消费方（Background.vue 的 getApp/getCanvas）始终读到最新值
    get app() {
      return l2d
    },
    get canvas() {
      return canvas
    },
    webglFailed,
    getSpine: () => animation,
    getId: () => id,
    isReady: () => animationReady,
    setL2D,
    skipStartIdle
  }
}
