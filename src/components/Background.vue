<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Spine } from '@esotericsoftware/spine-pixi-v8'
import { useConfig } from '@/composables/useConfig'
import { useModalOpen } from '@/composables/useModalOpen'
import { useTalkPlayer } from '@/composables/spine/useTalkPlayer'
import { useGazeFollow } from '@/composables/spine/useGazeFollow'
import { useHeadPat } from '@/composables/spine/useHeadPat'
import { useBoneDrag } from '@/composables/spine/useBoneDrag'
import { useRandomClips } from '@/composables/spine/useRandomClips'
import { usePointerSession } from '@/composables/spine/usePointerSession'
import { useDialogueAnchor } from '@/composables/spine/useDialogueAnchor'
import {
  useSpineLifecycle,
  type SpineLifecyclePointerHooks
} from '@/composables/spine/useSpineLifecycle'
import { findDialogueAnchorBone } from '@/composables/spine/boneDetect'
import { boneToClientPoint } from '@/composables/spine/boneToClient'
import type { SpineInteractionContext } from '@/composables/spine/types'
import { useSettings } from '@/composables/useSettings'

const { configs, locale } = useConfig()
const { lobbyArrowKeys } = useSettings()
const { modalOpen } = useModalOpen()
const emit = defineEmits<{
  canskip: [value: boolean]
  'update:changeL2D': [value: boolean]
  'webgl-failed': []
}>()
const props = defineProps<{
  l2dOnly: boolean
}>()

const currentConfig = computed(() => configs.value)
const canSkip = ref(true)
const dialogue = ref('')
const showDialogue = ref(false)

const spineApi = {
  getSpine: (): Spine | null => null,
  getId: () => 0,
  isReady: () => false
}

const ctx: SpineInteractionContext = {
  getSpine: () => spineApi.getSpine(),
  getLobby: () => currentConfig.value?.memorialLobbies?.[spineApi.getId()],
  getLocale: () => locale.value,
  isReady: () => spineApi.isReady(),
  isIdleMode: () => spineApi.getSpine()?.state?.getCurrent(0)?.animation?.name === 'Idle_01',
  dialogue,
  showDialogue,
  flags: { talking: ref(false), ifPetting: ref(false) },
  getPat: () => pat,
  getGaze: () => gaze,
  getBoneDrag: () => boneDrag
}

const talkPlayer = useTalkPlayer(ctx)
const gaze = useGazeFollow(ctx)
const pat = useHeadPat(ctx)
const boneDrag = useBoneDrag(ctx)
const randomClips = useRandomClips(ctx)

const pointerHooks: SpineLifecyclePointerHooks = {
  cancelPressSession: () => {},
  invalidateViewRect: () => {},
  addEventListenersToCanvas: () => {},
  removeEventListenersFromCanvas: () => {},
  cancelHoverRaf: () => {}
}

const spine = useSpineLifecycle({
  emit,
  currentConfig,
  canSkip,
  showDialogue,
  talkPlayer,
  gaze,
  pat,
  boneDrag,
  randomClips,
  pointer: pointerHooks
})

spineApi.getSpine = spine.getSpine
spineApi.getId = spine.getId
spineApi.isReady = spine.isReady

const pointer = usePointerSession({
  getSpine: spine.getSpine,
  getCanvas: () => spine.canvas,
  getApp: () => spine.app,
  isReady: spine.isReady,
  ctx,
  pat,
  gaze,
  boneDrag,
  talkPlayer
})

pointerHooks.cancelPressSession = pointer.cancelPressSession
pointerHooks.invalidateViewRect = pointer.invalidateViewRect
pointerHooks.addEventListenersToCanvas = pointer.addEventListenersToCanvas
pointerHooks.removeEventListenersFromCanvas = pointer.removeEventListenersFromCanvas
pointerHooks.cancelHoverRaf = pointer.cancelHoverRaf

const { setL2D, skipStartIdle, webglFailed } = spine

/** SKIP 按钮瞬态可见：演出开始展示 1s 后自动隐藏，之后由 hover（桌面）/ 点按（触屏）唤起 */
const skipShown = ref(false)
let skipHideTimer: number | null = null
// 触屏判定与 Toolbox 一致：hover: none 视为触屏
const hoverMedia = window.matchMedia('(hover: none)')
const isTouch = ref(hoverMedia.matches)
const onHoverMediaChange = (e: MediaQueryListEvent) => {
  isTouch.value = e.matches
}

// Background 在加载屏撤下后才挂载（App.vue v-if="!loading"），immediate 即覆盖首访开场；
// 之后切角色 canSkip false→true 翻转同样走这里
watch(
  canSkip,
  (skippable) => {
    if (skipHideTimer) {
      clearTimeout(skipHideTimer)
      skipHideTimer = null
    }
    skipShown.value = skippable
    if (skippable) {
      skipHideTimer = window.setTimeout(() => {
        skipShown.value = false
        skipHideTimer = null
      }, 1000)
    }
  },
  { immediate: true }
)

/** 全屏跳过层点击：桌面直接弹跳过确认；触屏先点按唤起 SKIP 按钮（还原游戏内点按出 UI） */
const onSkipLayerClick = () => {
  if (isTouch.value) {
    skipShown.value = !skipShown.value
    return
  }
  skipStartIdle()
}

const dialogueLayerEl = ref<HTMLElement | null>(null)

const {
  side: dialogueSide,
  layerStyle: dialogueLayerStyle,
  onResize: onDialogueResize
} = useDialogueAnchor({
  showDialogue,
  getSpine: spine.getSpine,
  getCanvas: () => spine.canvas,
  getApp: () => spine.app,
  getLobby: () => currentConfig.value?.memorialLobbies?.[spineApi.getId()],
  getLayerEl: () => dialogueLayerEl.value
})

/** 弹窗打开时不显示台词（避免挡在 Modal 上方） */
const dialogueVisible = computed(() => showDialogue.value && !modalOpen.value)

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

const onLobbyKeydown = (e: KeyboardEvent) => {
  if (!lobbyArrowKeys.value) return
  if (props.l2dOnly || webglFailed.value) return
  if (isEditableTarget(e.target)) return
  if (modalOpen.value) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    setL2D('-')
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    setL2D('+')
  }
}

const onWindowResize = () => {
  onDialogueResize()
}

onMounted(() => {
  window.addEventListener('keydown', onLobbyKeydown)
  window.addEventListener('resize', onWindowResize)
  hoverMedia.addEventListener('change', onHoverMediaChange)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onLobbyKeydown)
  window.removeEventListener('resize', onWindowResize)
  hoverMedia.removeEventListener('change', onHoverMediaChange)
  if (skipHideTimer) {
    clearTimeout(skipHideTimer)
    skipHideTimer = null
  }
})

if (import.meta.env.DEV) {
  window.__l2dDebug = {
    getState: () => {
      const currentAnimation = spine.getSpine()
      return {
        ready: spine.isReady(),
        idle: ctx.isIdleMode(),
        talking: ctx.flags.talking.value,
        petting: ctx.flags.ifPetting.value,
        gazing: gaze.isActive(),
        dragging: boneDrag.isActive(),
        gazeBone: gaze.boneName(),
        pat: pat.debugInfo(),
        dragBones: boneDrag.targetNames(),
        tracks: currentAnimation?.state
          ? [0, 1, 2, 3, 4].map(
              (track) => currentAnimation.state.getCurrent(track)?.animation?.name ?? null
            )
          : [],
        character: currentAnimation?.skeleton?.data?.name ?? null
      }
    },
    boneClientPos: (name) => {
      const animation = spine.getSpine()
      if (!animation || !spine.canvas || !spine.app) return null
      return boneToClientPoint(animation, spine.canvas, spine.app, name)
    },
    dialogueAnchorPos: () => {
      const animation = spine.getSpine()
      if (!animation || !spine.canvas || !spine.app) return null
      const lobby = currentConfig.value?.memorialLobbies?.[spineApi.getId()]
      const bone = findDialogueAnchorBone(animation.skeleton, lobby?.dialogueDisplay?.bone)
      if (!bone) return null
      return boneToClientPoint(animation, spine.canvas, spine.app, bone.data.name)
    },
    switchCharacter: (index) => setL2D(index),
    listBones: (pattern) => {
      const animation = spine.getSpine()
      if (!animation) return []
      const re = new RegExp(pattern, 'i')
      return animation.skeleton.bones.filter((b) => re.test(b.data.name)).map((b) => b.data.name)
    }
  }
}
</script>

<template>
  <div id="change" v-if="!props.l2dOnly && !webglFailed">
    <!-- 原生 button：Enter/Space 由浏览器接管；←/→ 方向键切换角色保留（非原生行为） -->
    <button
      type="button"
      class="css-cursor-hover-enabled"
      :aria-label="currentConfig?.translate?.prevPage"
      @click="setL2D('-')"
      @keydown.left.prevent="setL2D('-')"
      @keydown.right.prevent="setL2D('+')"
    >
      <img src="/l2d/arrow.png" alt="" />
    </button>
    <button
      type="button"
      class="css-cursor-hover-enabled"
      :aria-label="currentConfig?.translate?.nextPage"
      @click="setL2D('+')"
      @keydown.left.prevent="setL2D('-')"
      @keydown.right.prevent="setL2D('+')"
    >
      <img src="/l2d/arrow.png" alt="" />
    </button>
  </div>
  <!-- 演出期间全屏点击跳过层（桌面点任意处弹确认；触屏点按先唤起下方 SKIP 按钮）。
       透明层不再可聚焦——「可聚焦不可见」是 a11y 瑕疵，键盘走下方可见 SKIP 按钮 -->
  <div
    v-if="props.l2dOnly && canSkip && !webglFailed"
    style="position: fixed; width: 100%; height: 100%; z-index: 2"
    aria-hidden="true"
    @click="onSkipLayerClick"
  ></div>
  <!-- 可见 SKIP 按钮：还原游戏内演出常驻 SKIP，与跳过层同条件；
       短文案 skip + skipStartIdle 确认 Modal；显示 1s 后自动隐藏，
       桌面 hover / 键盘聚焦（skip-link 模式）/ 触屏点按跳过层可唤起 -->
  <button
    v-if="props.l2dOnly && canSkip && !webglFailed"
    type="button"
    class="skip-intro css-cursor-hover-enabled"
    :class="{ 'skip-hidden': !skipShown }"
    :style="{ pointerEvents: isTouch && !skipShown ? 'none' : undefined }"
    @click="skipStartIdle()"
  >
    <span>{{ currentConfig?.translate?.skip || 'Skip' }}</span>
  </button>
  <div
    v-if="dialogueVisible"
    ref="dialogueLayerEl"
    class="dialogue-layer"
    :style="dialogueLayerStyle"
  >
    <div
      class="dialogue"
      :class="`dialogue--${dialogueSide}`"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ dialogue }}
    </div>
  </div>
</template>

<style scoped>
.dialogue-layer {
  position: fixed;
  z-index: 50;
  pointer-events: none;
  max-width: min(calc(100vw - 24px), 40vw);
}

.dialogue {
  /* 气泡与锚点一侧的间距（margin 与压缩时 max-width 的扣除量共用） */
  --bubble-side-gap: clamp(8px, 0.5vw, 100vw);
  position: relative;
  padding: clamp(30px, 1.875vw, 100vw) clamp(20px, 1.25vw, 100vw);
  width: max-content;
  /* --dialogue-max-w 由 useDialogueAnchor 视口收边后内联到气泡层：
     贴边时气泡压缩换行；未收边时回退 100vw，等同只看原 clamp 上限 */
  max-width: min(
    clamp(280px, 17.5vw, 100vw),
    calc(var(--dialogue-max-w, 100vw) - var(--bubble-side-gap))
  );
  font-size: clamp(24px, 1.5vw, 100vw);
  background-color: #f0f0f0dd;
  border-radius: clamp(10px, 0.625vw, 100vw);
  box-shadow: 0 clamp(2px, 0.125vw, 100vw) clamp(8px, 0.5vw, 100vw) 0 rgba(0, 0, 0, 0.15);
}

/* 三角箭头（只画向外的一半） */
.dialogue--right {
  margin-left: var(--bubble-side-gap);
}

.dialogue--left {
  margin-right: var(--bubble-side-gap);
}

.dialogue--right::before,
.dialogue--left::before {
  content: '';
  position: absolute;
  top: 50%;
  width: 0;
  height: 0;
  background: none;
  box-shadow: none;
  transform: translateY(-50%);
  pointer-events: none;
  border-top: clamp(9px, 0.5625vw, 100vw) solid transparent;
  border-bottom: clamp(9px, 0.5625vw, 100vw) solid transparent;
}

.dialogue--right::before {
  left: 0;
  transform: translate(calc(-100% + 1px), -50%);
  border-right: clamp(10px, 0.625vw, 100vw) solid #f0f0f0dd;
  border-left: none;
}

.dialogue--left::before {
  right: 0;
  transform: translate(calc(100% - 1px), -50%);
  border-left: clamp(10px, 0.625vw, 100vw) solid #f0f0f0dd;
  border-right: none;
}

#change {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
  box-sizing: border-box;
}

#change button {
  /* 原生 button 的 UA 样式重置：尺寸/动画由原 img 转移到 button 上 */
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  width: clamp(32px, 2vw, 100vw);
  height: auto;
  animation: move 2s ease-in-out infinite;
  z-index: 1000;
}

#change button img {
  width: 100%;
  height: auto;
  display: block;
}

#change button:last-child {
  transform: rotate(180deg);
  animation: moveReverse 2s ease-in-out infinite;
}

@keyframes move {
  0% {
    transform: translateX(clamp(10px, 0.625vw, 100vw));
  }
  50% {
    transform: translateX(clamp(30px, 1.875vw, 100vw));
  }
  100% {
    transform: translateX(clamp(10px, 0.625vw, 100vw));
  }
}

@keyframes moveReverse {
  0% {
    transform: rotate(180deg) translateX(clamp(10px, 0.625vw, 100vw));
  }
  50% {
    transform: rotate(180deg) translateX(clamp(30px, 1.875vw, 100vw));
  }
  100% {
    transform: rotate(180deg) translateX(clamp(10px, 0.625vw, 100vw));
  }
}

/* 演出期间常驻的可见 SKIP：复用工具箱按钮视觉（斜切白底盒），位于右上角工具箱常态位置。
   宽度随内容走（各语言文案长度差大），z-index 高于跳过层（2）、低于台词层（50） */
.skip-intro {
  appearance: none;
  border: none;
  padding: 0 clamp(28px, 1.75vw, 100vw);
  font: inherit;
  font-weight: bold;
  position: fixed;
  right: calc(clamp(20px, 1.25vw, 100vw) + var(--safe-right));
  top: calc(clamp(40px, 2.5vw, 100vw) + var(--safe-top));
  z-index: 3;
  min-height: clamp(56px, 3.5vw, 100vw);
  background: #fffd;
  color: #003153;
  transform: translateY(0) skew(-10deg);
  border-radius: clamp(6px, 0.375vw, 100vw);
  filter: drop-shadow(0px 0px clamp(3px, 0.1875vw, 100vw) #0003);
  transition:
    background-color 0.3s,
    transform 0.3s,
    opacity 0.6s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(26px, 1.625vw, 100vw);
  white-space: nowrap;
  opacity: 1;
}

/* 自动隐藏后仍留唤起口：桌面 hover、键盘聚焦（聚焦即显现，skip-link 模式）。
   触屏隐藏时另有 pointer-events: none，点按落到跳过层换成唤起按钮 */
.skip-intro.skip-hidden {
  opacity: 0;
}

.skip-intro.skip-hidden:hover,
.skip-intro.skip-hidden:focus-visible {
  opacity: 1;
}

.skip-intro span {
  transform: skew(10deg);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.skip-intro:hover {
  background: #fffe;
}

.skip-intro:active {
  transform: translateY(0) skew(-10deg) scale(0.9);
}

@media (prefers-reduced-motion: reduce) {
  #change button {
    animation: none;
    transform: translateX(clamp(30px, 1.875vw, 100vw));
  }

  #change button:last-child {
    transform: rotate(180deg) translateX(clamp(30px, 1.875vw, 100vw));
  }
}
</style>
