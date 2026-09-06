import { computed, effectScope, ref, watch } from 'vue'

/** 开场演出播放策略：每次进入都播 / 仅首次访问播 */
export type IntroMode = 'always' | 'once'

interface SettingsPersistedState {
  voiceMuted?: boolean
  voiceVolume?: number
  bgmMuted?: boolean
  bgmVolume?: number
  introMode?: IntroMode
  introSeen?: boolean
  clickEffect?: boolean
  /** 大厅 HUD 展开时 ← / → 切换回忆大厅角色 */
  lobbyArrowKeys?: boolean
}

const STORAGE_KEY = 'fa-settings'
/** 与改造前 useTalkPlayer 里硬编码的语音音量保持一致 */
const DEFAULT_VOICE_VOLUME = 0.3
/** BGM 默认音量 */
const DEFAULT_BGM_VOLUME = 0.7

// 模块级单例：Toolbox（设置面板）与各播放器共享同一份偏好
const voiceMuted = ref(false)
const voiceVolume = ref(DEFAULT_VOICE_VOLUME)
const bgmMuted = ref(false)
const bgmVolume = ref(DEFAULT_BGM_VOLUME)
const introMode = ref<IntroMode>('once')
const clickEffect = ref(true)
const lobbyArrowKeys = ref(true)

// 「已看过开场」不是用户可调项，不进 UI，只用于 introMode === 'once' 的判断
let introSeen = false
let initialized = false
let storageSyncRegistered = false
/** 跨 tab 同步写入内存时跳过 watch 落盘，避免多余 localStorage 写 */
let applyingRemote = false

const readVolume = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

// localStorage 在隐私模式等场景可能不可用，静默降级为仅本次会话生效
const loadState = (): SettingsPersistedState => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) as string) || {}
  } catch {
    return {}
  }
}

const applyPersistedState = (state: SettingsPersistedState) => {
  applyingRemote = true
  try {
    voiceMuted.value = state.voiceMuted ?? false
    voiceVolume.value = readVolume(state.voiceVolume, DEFAULT_VOICE_VOLUME)
    bgmMuted.value = state.bgmMuted ?? false
    bgmVolume.value = readVolume(state.bgmVolume, DEFAULT_BGM_VOLUME)
    introMode.value = state.introMode === 'always' ? 'always' : 'once'
    clickEffect.value = state.clickEffect ?? true
    lobbyArrowKeys.value = state.lobbyArrowKeys ?? true
    if (state.introSeen !== undefined) introSeen = state.introSeen
  } finally {
    applyingRemote = false
  }
}

const saveState = () => {
  if (applyingRemote) return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        voiceMuted: voiceMuted.value,
        voiceVolume: voiceVolume.value,
        bgmMuted: bgmMuted.value,
        bgmVolume: bgmVolume.value,
        introMode: introMode.value,
        introSeen,
        clickEffect: clickEffect.value,
        lobbyArrowKeys: lobbyArrowKeys.value
      })
    )
  } catch {
    /* 忽略持久化失败 */
  }
}

// 独立的 effectScope：偏好监听不能挂在首个调用组件的作用域上，
// 否则该组件卸载后监听被一并停掉，后续修改不再落盘
const scope = effectScope(true)

const registerStorageSync = () => {
  if (storageSyncRegistered) return
  storageSyncRegistered = true
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    // 其他标签页删键（newValue === null）：视为清档，本标签页恢复默认设置
    if (event.newValue == null) {
      applyPersistedState({})
      return
    }
    try {
      applyPersistedState(JSON.parse(event.newValue) as SettingsPersistedState)
    } catch {
      /* 忽略损坏数据 */
    }
  })
}

const ensureInit = () => {
  if (initialized) return
  initialized = true

  applyPersistedState(loadState())
  registerStorageSync()

  scope.run(() => {
    watch(
      [voiceMuted, voiceVolume, bgmMuted, bgmVolume, introMode, clickEffect, lobbyArrowKeys],
      saveState
    )
  })
}

/** 语音实际音量（静音时为 0，播放器据此跳过加载） */
const effectiveVoiceVolume = computed(() => (voiceMuted.value ? 0 : voiceVolume.value))
/** BGM 实际音量（静音时为 0，MusicBanner 据此暂停） */
const effectiveBgmVolume = computed(() => (bgmMuted.value ? 0 : bgmVolume.value))

/** 本次进入是否播放开场演出（仅对首帧加载生效，切换角色始终播放） */
const shouldPlayIntro = (): boolean => {
  ensureInit()
  return introMode.value === 'always' || !introSeen
}

/** 开场演出播放（或被跳过）后记账，供下次访问判断 */
const markIntroSeen = () => {
  ensureInit()
  if (introSeen) return
  introSeen = true
  saveState()
}

export function useSettings() {
  ensureInit()

  return {
    voiceMuted,
    voiceVolume,
    bgmMuted,
    bgmVolume,
    introMode,
    clickEffect,
    lobbyArrowKeys,
    effectiveVoiceVolume,
    effectiveBgmVolume,
    shouldPlayIntro,
    markIntroSeen
  }
}
